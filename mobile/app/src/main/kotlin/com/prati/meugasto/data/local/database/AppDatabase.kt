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
    version = 6,
    exportSchema = true
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

        val MIGRATION_3_4 = object : androidx.room.migration.Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE purchases ADD COLUMN accessKey TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_4_5 = object : androidx.room.migration.Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE purchases ADD COLUMN pendingCloudUserId TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_5_6 = object : androidx.room.migration.Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE items ADD COLUMN canonicalName TEXT NOT NULL DEFAULT ''")

                // SQL não normaliza acentos, pontuação e abreviações como o runtime.
                // Por isso o backfill usa a mesma função aplicada a novas compras.
                val rows = mutableListOf<ItemCanonicalNameBackfill.Row>()
                db.query("SELECT id, name, code FROM items").use { cursor ->
                    while (cursor.moveToNext()) {
                        rows += ItemCanonicalNameBackfill.Row(
                            id = cursor.getLong(0),
                            name = cursor.getString(1).orEmpty(),
                            code = if (cursor.isNull(2)) null else cursor.getString(2)
                        )
                    }
                }

                val statement = db.compileStatement("UPDATE items SET canonicalName = ? WHERE id = ?")
                for ((id, canonicalName) in ItemCanonicalNameBackfill.canonicalNames(rows)) {
                    statement.bindString(1, canonicalName)
                    statement.bindLong(2, id)
                    statement.executeUpdateDelete()
                }
            }
        }

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "meugasto.db"
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6)
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

