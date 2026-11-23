package com.prati.meugasto.data.repository

import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.DraftEntity
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.SupermarketEntity
import com.prati.meugasto.data.local.database.ProductStats
import com.prati.meugasto.data.local.database.ProductPriceEntry
import com.prati.meugasto.domain.comparator.ProductCanonicalizer
import com.prati.meugasto.domain.export.DataExportProfile
import com.prati.meugasto.domain.export.buildDataExport
import com.prati.meugasto.domain.model.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class SavePurchaseResult(
    val id: Long,
    val alreadyExisted: Boolean,
    val warning: String? = null
)

interface PurchaseRepository {
    fun getPurchases(): Flow<List<Purchase>>
    suspend fun savePurchase(purchase: Purchase): SavePurchaseResult
    suspend fun deletePurchase(purchaseId: Long)
    fun getDashboardStats(): Flow<DashboardStats>
    fun getSpendingByMarket(): Flow<List<Pair<String, Double>>>
    fun getSpendingByDate(): Flow<List<Pair<String, Double>>>
    fun getTopProducts(limit: Int = 10): Flow<List<ProductStats>>
    fun getProductPriceHistory(productName: String): Flow<List<ProductPriceEntry>>
    fun getAllProductNames(): Flow<List<String>>
}

fun interface RemotePurchaseDeleter {
    suspend fun delete(remoteId: Long)
}

class LocalPurchaseRepository(
    private val database: AppDatabase,
    private val remotePurchaseDeleter: RemotePurchaseDeleter,
    private val currentAppMode: () -> AppMode,
    private val currentCloudUserId: () -> String?,
    private val repairCloudReceipt: (suspend (Long, Purchase) -> Unit)? = null
) : PurchaseRepository {

    override fun getPurchases(): Flow<List<Purchase>> {
        return database.purchaseDao().getAllWithDetails().map { list ->
            list.map { detail ->
                Purchase(
                    id = detail.purchase.id,
                    supermarket = detail.supermarket.toDomain(),
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

    override suspend fun savePurchase(purchase: Purchase): SavePurchaseResult {
        val normalizedKey = com.prati.meugasto.data.local.database.PurchaseAccessKeyHasher.normalizeAccessKey(purchase.accessKey)
        val keyHash = com.prati.meugasto.data.local.database.PurchaseAccessKeyHasher.sha256Hex(normalizedKey)
        if (purchase.id == 0L && keyHash != null) {
            database.purchaseDao().findIdByAccessKeyHash(keyHash)?.let { existingId ->
                if (currentAppMode() == AppMode.CLOUD && currentCloudUserId() != null) {
                    try {
                        repairCloudReceipt?.invoke(existingId, purchase)
                    } catch (error: CancellationException) {
                        throw error
                    } catch (_: Exception) {
                        return SavePurchaseResult(existingId, alreadyExisted = true,
                            warning = "Não foi possível verificar os preços na nuvem. A compra continua salva. Tente novamente quando estiver conectado.")
                    }
                }
                return SavePurchaseResult(existingId, alreadyExisted = true)
            }
        }

        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())

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

        val pendingCloudUser = if (currentAppMode() == AppMode.CLOUD) currentCloudUserId() else null
        val purchaseEntity = PurchaseEntity(
            id = purchase.id,
            supermarketId = marketId,
            date = purchase.date,
            totalPrice = safeTotalPrice,
            isManual = purchase.isManual,
            createdAt = purchase.createdAt ?: now,
            updatedAt = now,
            accessKey = if (pendingCloudUser != null) normalizedKey else null,
            pendingCloudUserId = pendingCloudUser,
            accessKeyHash = keyHash
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
                price = item.price,
                canonicalName = ProductCanonicalizer.canonicalKey(item.name, item.code)
            )
        }

        val outcome = database.purchaseDao().savePurchaseWithItems(purchaseEntity, itemEntities)
        return SavePurchaseResult(outcome.id, outcome.alreadyExisted)
    }

    override suspend fun deletePurchase(purchaseId: Long) {
        val detail = database.purchaseDao().getById(purchaseId)
        if (detail != null) {
            if (currentAppMode() == AppMode.CLOUD) {
                detail.purchase.remoteId?.let { remotePurchaseDeleter.delete(it) }
            }
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

/** Retrato completo dos dados guardados pelo app, no formato de exportação LGPD. */
interface DataExportRepository {
    suspend fun exportJson(): String
}

class LocalDataExportRepository(
    private val database: AppDatabase,
    private val purchaseRepository: PurchaseRepository,
    private val appVersion: String?,
    private val currentProfile: () -> DataExportProfile?,
    private val now: () -> String = {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(Date())
    }
) : DataExportRepository {

    override suspend fun exportJson(): String = withContext(Dispatchers.IO) {
        val supermarkets = database.supermarketDao().getAll().first().map { it.toDomain(includeCreatedAt = true) }
        val purchases = purchaseRepository.getPurchases().first()
        val shoppingLists = database.shoppingListDao().getAllLists().first().map { detail ->
            ShoppingList(
                id = detail.shoppingList.id,
                name = detail.shoppingList.name,
                status = detail.shoppingList.status,
                createdAt = detail.shoppingList.createdAt,
                updatedAt = detail.shoppingList.updatedAt,
                items = detail.items.map { item ->
                    ShoppingListItem(
                        id = item.id,
                        shoppingListId = item.shoppingListId,
                        name = item.name,
                        quantity = item.quantity,
                        unit = item.unit,
                        estimatedPrice = item.estimatedPrice,
                        createdAt = item.createdAt
                    )
                }
            )
        }
        val drafts = database.draftDao().getAllDrafts().first().map { it.toDomain(supermarkets) }

        buildDataExport(
            exportedAt = now(),
            appVersion = appVersion,
            profile = currentProfile(),
            supermarkets = supermarkets,
            purchases = purchases,
            shoppingLists = shoppingLists,
            drafts = drafts
        )
    }
}

private val draftItemsJson = Json { ignoreUnknownKeys = true }

private fun SupermarketEntity.toDomain(includeCreatedAt: Boolean = false): Supermarket {
    val detectedOrSavedType = try {
        EstablishmentType.valueOf(type)
    } catch (_: Exception) {
        EstablishmentDetector.detectType(name)
    }
    return Supermarket(
        id = id,
        name = name,
        cnpj = cnpj,
        city = city,
        state = state,
        type = detectedOrSavedType,
        isManual = isManual,
        createdAt = if (includeCreatedAt) createdAt else null
    )
}

/** Formato dos itens do rascunho é opaco; rascunho ilegível ainda exporta o conteúdo. */
private fun DraftEntity.toDomain(supermarkets: List<Supermarket>): Draft = Draft(
    id = id,
    supermarket = supermarketId?.let { marketId -> supermarkets.firstOrNull { it.id == marketId } },
    content = content,
    items = runCatching {
        draftItemsJson.decodeFromString<List<DraftItem>>(itemsJson)
    }.getOrDefault(emptyList()),
    totalPrice = totalPrice,
    createdAt = createdAt,
    updatedAt = updatedAt
)

