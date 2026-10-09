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
    version = 3,
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

        val MIGRATION_1_2 = object : androidx.room.migration.Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE supermarkets ADD COLUMN type TEXT NOT NULL DEFAULT 'SUPERMARKET'")
            }
        }

        val MIGRATION_2_3 = object : androidx.room.migration.Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE supermarkets ADD COLUMN remoteId INTEGER DEFAULT NULL")
                db.execSQL("ALTER TABLE purchases ADD COLUMN remoteId INTEGER DEFAULT NULL")
                db.execSQL("ALTER TABLE items ADD COLUMN remoteId INTEGER DEFAULT NULL")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_supermarkets_remoteId ON supermarkets(remoteId)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_purchases_remoteId ON purchases(remoteId)")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_items_remoteId ON items(remoteId)")
            }
        }

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "meugasto.db"
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .addCallback(object : RoomDatabase.Callback() {
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

