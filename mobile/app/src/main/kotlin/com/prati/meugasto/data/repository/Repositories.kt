package com.prati.meugasto.data.repository

import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.SupermarketEntity
import com.prati.meugasto.data.local.database.ProductStats
import com.prati.meugasto.data.local.database.ProductPriceEntry
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

interface PurchaseRepository {
    fun getPurchases(): Flow<List<Purchase>>
    suspend fun savePurchase(purchase: Purchase): Long
    suspend fun deletePurchase(purchaseId: Long)
    fun getDashboardStats(): Flow<DashboardStats>
    fun getSpendingByMarket(): Flow<List<Pair<String, Double>>>
    fun getSpendingByDate(): Flow<List<Pair<String, Double>>>
    fun getTopProducts(limit: Int = 10): Flow<List<ProductStats>>
    fun getProductPriceHistory(productName: String): Flow<List<ProductPriceEntry>>
    fun getAllProductNames(): Flow<List<String>>
}

class LocalPurchaseRepository(
    private val database: AppDatabase
) : PurchaseRepository {

    override fun getPurchases(): Flow<List<Purchase>> {
        return database.purchaseDao().getAllWithDetails().map { list ->
            list.map { detail ->
                val detectedOrSavedType = try {
                    EstablishmentType.valueOf(detail.supermarket.type)
                } catch (_: Exception) {
                    EstablishmentDetector.detectType(detail.supermarket.name)
                }
                Purchase(
                    id = detail.purchase.id,
                    supermarket = Supermarket(
                        id = detail.supermarket.id,
                        name = detail.supermarket.name,
                        cnpj = detail.supermarket.cnpj,
                        city = detail.supermarket.city,
                        state = detail.supermarket.state,
                        type = detectedOrSavedType,
                        isManual = detail.supermarket.isManual
                    ),
                    date = detail.purchase.date,
                    totalPrice = detail.purchase.totalPrice,
                    isManual = detail.purchase.isManual,
                    products = detail.items.map { itemEntity ->
                        Item(
                            id = itemEntity.id,
                            purchaseId = itemEntity.purchaseId,
                            name = itemEntity.name,
                            code = itemEntity.code,
                            categoryId = itemEntity.categoryId,
                            quantity = itemEntity.quantity,
                            unit = itemEntity.unit,
                            price = itemEntity.price
                        )
                    },
                    createdAt = detail.purchase.createdAt,
                    updatedAt = detail.purchase.updatedAt
                )
            }
        }
    }

    override suspend fun savePurchase(purchase: Purchase): Long {
        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())
        
        // Obter ou criar supermercado
        val existingMarket = database.supermarketDao().findByName(purchase.supermarket.name)
        val marketId = existingMarket?.id ?: database.supermarketDao().insert(
            SupermarketEntity(
                name = purchase.supermarket.name,
                cnpj = purchase.supermarket.cnpj,
                city = purchase.supermarket.city,
                state = purchase.supermarket.state,
                type = purchase.supermarket.type.name,
                isManual = purchase.supermarket.isManual,
                createdAt = now
            )
        )

        val itemsSum = purchase.products.sumOf { it.price }
        val safeTotalPrice = if (purchase.products.size > 1 && (purchase.totalPrice <= 0.0 || (purchase.totalPrice == purchase.products.first().price && itemsSum > purchase.totalPrice) || purchase.totalPrice < itemsSum * 0.4)) {
            itemsSum
        } else {
            purchase.totalPrice
        }

        val purchaseEntity = PurchaseEntity(
            id = purchase.id,
            supermarketId = marketId,
            date = purchase.date,
            totalPrice = safeTotalPrice,
            isManual = purchase.isManual,
            createdAt = purchase.createdAt ?: now,
            updatedAt = now
        )

        val itemEntities = purchase.products.map { item ->
            ItemEntity(
                id = item.id,
                purchaseId = 0, // atualizado na inserção transacional
                name = item.name,
                code = item.code,
                categoryId = item.categoryId,
                quantity = item.quantity,
                unit = item.unit,
                price = item.price
            )
        }

        return database.purchaseDao().insertPurchaseWithItems(purchaseEntity, itemEntities)
    }

    override suspend fun deletePurchase(purchaseId: Long) {
        val detail = database.purchaseDao().getById(purchaseId)
        if (detail != null) {
            database.purchaseDao().deletePurchase(detail.purchase)
        }
    }

    override fun getDashboardStats(): Flow<DashboardStats> {
        val totalSpentFlow = database.purchaseDao().getTotalSpent()
        val countFlow = database.purchaseDao().getPurchaseCount()
        val itemCountFlow = database.purchaseDao().getItemCount()

        return combine(totalSpentFlow, countFlow, itemCountFlow) { total, count, items ->
            DashboardStats(
                totalSpent = total ?: 0.0,
                purchaseCount = count,
                itemCount = items,
                savings = 0.0
            )
        }
    }

    override fun getSpendingByMarket(): Flow<List<Pair<String, Double>>> {
        return database.purchaseDao().getSpendingByMarket().map { list ->
            list.map { Pair(it.supermarketName, it.total) }
        }
    }

    override fun getSpendingByDate(): Flow<List<Pair<String, Double>>> {
        return database.purchaseDao().getSpendingByDate().map { list ->
            list.map { Pair(it.date, it.total) }
        }
    }

    override fun getTopProducts(limit: Int): Flow<List<ProductStats>> {
        return database.purchaseDao().getTopProducts(limit)
    }

    override fun getProductPriceHistory(productName: String): Flow<List<ProductPriceEntry>> {
        return database.purchaseDao().getProductPriceHistory(productName)
    }

    override fun getAllProductNames(): Flow<List<String>> {
        return database.purchaseDao().getAllProductNames()
    }
}

class UnifiedPurchaseRepository(
    private val localRepo: LocalPurchaseRepository,
    private val preferences: UserPreferences
) : PurchaseRepository {

    private fun activeRepo(): PurchaseRepository {
        // Quando estiver em modo CLOUD, pode delegar a Supabase;
        // Atualmente integra com Room localmente garantindo offline-first para ambos os modos.
        return localRepo
    }

    override fun getPurchases(): Flow<List<Purchase>> = activeRepo().getPurchases()
    override suspend fun savePurchase(purchase: Purchase): Long = activeRepo().savePurchase(purchase)
    override suspend fun deletePurchase(purchaseId: Long) = activeRepo().deletePurchase(purchaseId)
    override fun getDashboardStats(): Flow<DashboardStats> = activeRepo().getDashboardStats()
    override fun getSpendingByMarket(): Flow<List<Pair<String, Double>>> = activeRepo().getSpendingByMarket()
    override fun getSpendingByDate(): Flow<List<Pair<String, Double>>> = activeRepo().getSpendingByDate()
    override fun getTopProducts(limit: Int): Flow<List<ProductStats>> = activeRepo().getTopProducts(limit)
    override fun getProductPriceHistory(productName: String): Flow<List<ProductPriceEntry>> = activeRepo().getProductPriceHistory(productName)
    override fun getAllProductNames(): Flow<List<String>> = activeRepo().getAllProductNames()
}

