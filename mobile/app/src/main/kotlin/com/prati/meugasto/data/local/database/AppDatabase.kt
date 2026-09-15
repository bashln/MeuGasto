package com.prati.meugasto.data.local.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

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
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}

