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

@Dao
interface SupermarketDao {
    @Query("SELECT * FROM supermarkets WHERE name = :name LIMIT 1")
    suspend fun findByName(name: String): SupermarketEntity?

    @Query("SELECT * FROM supermarkets WHERE cnpj = :cnpj LIMIT 1")
    suspend fun findByCnpj(cnpj: String): SupermarketEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(supermarket: SupermarketEntity): Long

    @Query("SELECT * FROM supermarkets ORDER BY name ASC")
    fun getAll(): Flow<List<SupermarketEntity>>
}

@Dao
interface PurchaseDao {
    @Transaction
    @Query("SELECT * FROM purchases ORDER BY date DESC, id DESC")
    fun getAllWithDetails(): Flow<List<PurchaseWithSupermarketAndItems>>

    @Transaction
    @Query("SELECT * FROM purchases WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): PurchaseWithSupermarketAndItems?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPurchase(purchase: PurchaseEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<ItemEntity>)

    @Update
    suspend fun updatePurchase(purchase: PurchaseEntity)

    @Delete
    suspend fun deletePurchase(purchase: PurchaseEntity)

    @Query("DELETE FROM items WHERE purchaseId = :purchaseId")
    suspend fun deleteItemsByPurchaseId(purchaseId: Long)

    @Transaction
    suspend fun insertPurchaseWithItems(
        purchase: PurchaseEntity,
        items: List<ItemEntity>
    ): Long {
        val purchaseId = insertPurchase(purchase)
        val itemsWithId = items.map { it.copy(purchaseId = purchaseId) }
        insertItems(itemsWithId)
        return purchaseId
    }

    @Query("SELECT SUM(totalPrice) FROM purchases")
    fun getTotalSpent(): Flow<Double?>

    @Query("SELECT COUNT(*) FROM purchases")
    fun getPurchaseCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM items")
    fun getItemCount(): Flow<Int>
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

