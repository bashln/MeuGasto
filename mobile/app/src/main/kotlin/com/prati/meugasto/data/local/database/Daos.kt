package com.prati.meugasto.data.local.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

data class PurchaseWithSupermarketAndItems(
    @Embedded val purchase: PurchaseEntity,
    @Relation(parentColumn = "supermarketId", entityColumn = "id")
    val supermarket: SupermarketEntity,
    @Relation(parentColumn = "id", entityColumn = "purchaseId")
    val items: List<ItemEntity>
)

data class ShoppingListWithItems(
    @Embedded val shoppingList: ShoppingListEntity,
    @Relation(parentColumn = "id", entityColumn = "shoppingListId")
    val items: List<ShoppingListItemEntity>
)

data class MarketSpending(
    val supermarketName: String,
    val total: Double
)

data class DateSpending(
    val date: String,
    val total: Double
)

data class ProductStats(
    val name: String,
    val totalQty: Double,
    val totalSpent: Double,
    val purchaseCount: Int
)

data class ProductPriceEntry(
    val name: String,
    val price: Double,
    val unit: String,
    val date: String,
    val supermarketName: String
)

@Dao
interface SupermarketDao {
    @Query("SELECT * FROM supermarkets WHERE name = :name LIMIT 1")
    suspend fun findByName(name: String): SupermarketEntity?

    @Query("SELECT * FROM supermarkets WHERE cnpj = :cnpj LIMIT 1")
    suspend fun findByCnpj(cnpj: String): SupermarketEntity?

    @Query("SELECT id FROM supermarkets WHERE remoteId = :remoteId LIMIT 1")
    suspend fun findIdByRemoteId(remoteId: Long): Long?

    @Query("UPDATE supermarkets SET remoteId = :remoteId WHERE id = :id")
    suspend fun setRemoteId(id: Long, remoteId: Long)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(supermarket: SupermarketEntity): Long

    @Query("SELECT * FROM supermarkets ORDER BY name ASC")
    fun getAll(): Flow<List<SupermarketEntity>>

    @Query("UPDATE supermarkets SET remoteId = NULL WHERE remoteId IS NOT NULL")
    suspend fun clearRemoteIds()
}

data class PurchaseSaveOutcome(
    val id: Long,
    val alreadyExisted: Boolean
)

@Dao
interface PurchaseDao {
    @Transaction
    @Query("SELECT * FROM purchases ORDER BY date DESC, id DESC")
    fun getAllWithDetails(): Flow<List<PurchaseWithSupermarketAndItems>>

    @Transaction
    @Query("SELECT * FROM purchases WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): PurchaseWithSupermarketAndItems?

    @Query("SELECT id FROM purchases WHERE remoteId = :remoteId LIMIT 1")
    suspend fun findIdByRemoteId(remoteId: Long): Long?

    @Query("SELECT accessKeyHash FROM purchases WHERE id = :id LIMIT 1")
    suspend fun getAccessKeyHash(id: Long): String?

    @Query("SELECT id FROM purchases WHERE accessKeyHash = :accessKeyHash LIMIT 1")
    suspend fun findIdByAccessKeyHash(accessKeyHash: String): Long?

    @Query("SELECT id FROM purchases WHERE remoteId IS NULL AND pendingCloudUserId = :userId ORDER BY id")
    suspend fun getPendingCloudUploadIds(userId: String): List<Long>

    @Query("DELETE FROM purchases WHERE remoteId IS NOT NULL OR pendingCloudUserId IS NOT NULL")
    suspend fun deleteCloudAccountPurchases()

    @Query("DELETE FROM purchases WHERE remoteId IS NOT NULL")
    suspend fun deleteAllRemotePurchases()

    @Query("DELETE FROM purchases WHERE remoteId IS NOT NULL AND remoteId NOT IN (:remoteIds)")
    suspend fun deleteRemotePurchasesNotIn(remoteIds: List<Long>)

    @Query("UPDATE purchases SET accessKeyHash = :accessKeyHash WHERE id = :id AND accessKeyHash IS NULL")
    suspend fun setAccessKeyHashIfAbsent(id: Long, accessKeyHash: String)

    @Query("DELETE FROM purchases WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("UPDATE purchases SET remoteId = :remoteId, accessKey = NULL, pendingCloudUserId = NULL WHERE id = :id")
    suspend fun setRemoteId(id: Long, remoteId: Long)

    @Transaction
    suspend fun reconcileUploadedPurchase(localId: Long, remoteId: Long) {
        val cachedId = findIdByRemoteId(remoteId)
        if (cachedId == null || cachedId == localId) {
            setRemoteId(localId, remoteId)
            return
        }

        val accessKeyHash = getAccessKeyHash(localId)
        val hashOwnerId = accessKeyHash?.let { findIdByAccessKeyHash(it) }
        deleteById(localId)
        if (accessKeyHash != null && (hashOwnerId == null || hashOwnerId == localId || hashOwnerId == cachedId)) {
            setAccessKeyHashIfAbsent(cachedId, accessKeyHash)
        }
    }

    @Query(
        "UPDATE purchases SET supermarketId = :supermarketId, date = :date, totalPrice = :totalPrice, " +
            "isManual = :isManual, updatedAt = :updatedAt WHERE id = :id"
    )
    suspend fun updateFromRemote(
        id: Long,
        supermarketId: Long,
        date: String,
        totalPrice: Double,
        isManual: Boolean,
        updatedAt: String
    )

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPurchase(purchase: PurchaseEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertPurchaseIfAbsent(purchase: PurchaseEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<ItemEntity>)

    @Update
    suspend fun updatePurchase(purchase: PurchaseEntity)

    @Delete
    suspend fun deletePurchase(purchase: PurchaseEntity)

    @Query("DELETE FROM items WHERE purchaseId = :purchaseId")
    suspend fun deleteItemsByPurchaseId(purchaseId: Long)

    @Transaction
    suspend fun savePurchaseWithItems(
        purchase: PurchaseEntity,
        items: List<ItemEntity>
    ): PurchaseSaveOutcome {
        val existingId = purchase.accessKeyHash?.let { findIdByAccessKeyHash(it) }
        if (existingId != null) return PurchaseSaveOutcome(existingId, alreadyExisted = true)

        val purchaseId = insertPurchaseIfAbsent(purchase)
        if (purchaseId == -1L) {
            val racedId = purchase.accessKeyHash?.let { findIdByAccessKeyHash(it) }
                ?: throw IllegalStateException("Conflito ao salvar compra sem chave de acesso.")
            return PurchaseSaveOutcome(racedId, alreadyExisted = true)
        }

        insertItems(items.map { it.copy(purchaseId = purchaseId) })
        return PurchaseSaveOutcome(purchaseId, alreadyExisted = false)
    }

    @Query("SELECT SUM(totalPrice) FROM purchases")
    fun getTotalSpent(): Flow<Double?>

    @Query("SELECT COUNT(*) FROM purchases")
    fun getPurchaseCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM items")
    fun getItemCount(): Flow<Int>

    @Query("SELECT s.name as supermarketName, SUM(p.totalPrice) as total FROM purchases p JOIN supermarkets s ON p.supermarketId = s.id GROUP BY p.supermarketId ORDER BY total DESC")
    fun getSpendingByMarket(): Flow<List<MarketSpending>>

    @Query("SELECT date, SUM(totalPrice) as total FROM purchases GROUP BY date ORDER BY date ASC")
    fun getSpendingByDate(): Flow<List<DateSpending>>

    @Query("SELECT MIN(name) as name, SUM(quantity) as totalQty, SUM(price) as totalSpent, COUNT(DISTINCT purchaseId) as purchaseCount FROM items GROUP BY CASE WHEN canonicalName = '' THEN name ELSE canonicalName END ORDER BY totalSpent DESC LIMIT :limit")
    fun getTopProducts(limit: Int = 10): Flow<List<ProductStats>>

    @Query(
        "SELECT i.name, (i.price / CASE WHEN i.quantity > 0 THEN i.quantity ELSE 1.0 END) as price, " +
            "i.unit, p.date, s.name as supermarketName " +
            "FROM items i JOIN purchases p ON i.purchaseId = p.id JOIN supermarkets s ON p.supermarketId = s.id " +
            "WHERE i.name = :productName OR i.canonicalName = (" +
            "SELECT i2.canonicalName FROM items i2 " +
            "WHERE i2.name = :productName AND i2.canonicalName <> '' ORDER BY i2.id LIMIT 1) " +
            "ORDER BY p.date ASC"
    )
    fun getProductPriceHistory(productName: String): Flow<List<ProductPriceEntry>>

    @Query("SELECT DISTINCT i.name FROM items i ORDER BY i.name ASC")
    fun getAllProductNames(): Flow<List<String>>
}

@Dao
interface ShoppingListDao {
    @Transaction
    @Query("SELECT * FROM shopping_lists ORDER BY id DESC")
    fun getAllLists(): Flow<List<ShoppingListWithItems>>

    @Transaction
    @Query("SELECT * FROM shopping_lists WHERE id = :id LIMIT 1")
    suspend fun getListById(id: Long): ShoppingListWithItems?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertList(list: ShoppingListEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<ShoppingListItemEntity>)

    @Update
    suspend fun updateList(list: ShoppingListEntity)

    @Delete
    suspend fun deleteList(list: ShoppingListEntity)

    @Query("DELETE FROM shopping_list_items WHERE shoppingListId = :listId")
    suspend fun deleteItemsByListId(listId: Long)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItem(item: ShoppingListItemEntity): Long

    @Query("UPDATE shopping_list_items SET estimatedPrice = :price WHERE id = :id")
    suspend fun updateEstimatedPrice(id: Long, price: Double)
    @Delete
    suspend fun deleteItem(item: ShoppingListItemEntity)
}

@Dao
interface DraftDao {
    @Query("SELECT * FROM drafts ORDER BY id DESC")
    fun getAllDrafts(): Flow<List<DraftEntity>>

    @Query("SELECT * FROM drafts WHERE id = :id LIMIT 1")
    suspend fun getDraftById(id: Long): DraftEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(draft: DraftEntity): Long

    @Delete
    suspend fun delete(draft: DraftEntity)
}
