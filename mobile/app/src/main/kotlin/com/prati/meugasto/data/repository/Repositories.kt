package com.prati.meugasto.data.repository

import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.SupermarketEntity
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
}

class LocalPurchaseRepository(
    private val database: AppDatabase
) : PurchaseRepository {

    override fun getPurchases(): Flow<List<Purchase>> {
        return database.purchaseDao().getAllWithDetails().map { list ->
            list.map { detail ->
                Purchase(
                    id = detail.purchase.id,
                    supermarket = Supermarket(
                        id = detail.supermarket.id,
                        name = detail.supermarket.name,
                        cnpj = detail.supermarket.cnpj,
                        city = detail.supermarket.city,
                        state = detail.supermarket.state,
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
                isManual = purchase.supermarket.isManual,
                createdAt = now
            )
        )

        val purchaseEntity = PurchaseEntity(
            id = purchase.id,
            supermarketId = marketId,
            date = purchase.date,
            totalPrice = purchase.totalPrice,
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
}

