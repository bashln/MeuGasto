package com.prati.meugasto.data.local.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        SupermarketEntity::class,
        PurchaseEntity::class,
        ItemEntity::class,
        DraftEntity::class,
        ShoppingListEntity::class,
        ShoppingListItemEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun supermarketDao(): SupermarketDao
    abstract fun purchaseDao(): PurchaseDao
    abstract fun shoppingListDao(): ShoppingListDao
    abstract fun draftDao(): DraftDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "meugasto.db"
                ).addCallback(object : RoomDatabase.Callback() {
                    override fun onOpen(db: SupportSQLiteDatabase) {
                        super.onOpen(db)
                        try {
                            db.execSQL("""
                                UPDATE purchases 
                                SET totalPrice = (SELECT SUM(price) FROM items WHERE items.purchaseId = purchases.id)
                                WHERE id IN (
                                    SELECT p.id 
                                    FROM purchases p 
                                    JOIN items i ON p.id = i.purchaseId 
                                    GROUP BY p.id 
                                    HAVING COUNT(i.id) > 1 
                                       AND p.totalPrice = (SELECT price FROM items WHERE items.purchaseId = p.id LIMIT 1)
                                )
                            """.trimIndent())
                        } catch (_: Exception) {}
                    }
                }).build()
                INSTANCE = instance
                instance
            }
        }
    }
}

