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
    version = 7,
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

        val MIGRATION_6_7 = object : androidx.room.migration.Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE purchases ADD COLUMN accessKeyHash TEXT DEFAULT NULL")

                val rows = mutableListOf<PurchaseAccessKeyHasher.Row>()
                db.query("SELECT id, accessKey, remoteId, pendingCloudUserId FROM purchases ORDER BY id ASC").use { cursor ->
                    while (cursor.moveToNext()) {
                        rows += PurchaseAccessKeyHasher.Row(
                            id = cursor.getLong(0),
                            accessKey = if (cursor.isNull(1)) null else cursor.getString(1),
                            remoteId = if (cursor.isNull(2)) null else cursor.getLong(2),
                            pendingCloudUserId = if (cursor.isNull(3)) null else cursor.getString(3)
                        )
                    }
                }

                val setHashStmt = db.compileStatement("UPDATE purchases SET accessKeyHash = ? WHERE id = ?")
                val clearPlainKeyStmt = db.compileStatement("UPDATE purchases SET accessKey = NULL WHERE id = ?")
                val leaveQueueStmt = db.compileStatement("UPDATE purchases SET pendingCloudUserId = NULL WHERE id = ?")
                for (action in PurchaseAccessKeyHasher.planBackfill(rows)) {
                    if (action.accessKeyHash != null) {
                        setHashStmt.bindString(1, action.accessKeyHash)
                    } else {
                        setHashStmt.bindNull(1)
                    }
                    setHashStmt.bindLong(2, action.id)
                    setHashStmt.executeUpdateDelete()

                    if (action.clearPlaintextAccessKey) {
                        clearPlainKeyStmt.bindLong(1, action.id)
                        clearPlainKeyStmt.executeUpdateDelete()
                    }

                    if (action.leaveCloudUploadQueue) {
                        leaveQueueStmt.bindLong(1, action.id)
                        leaveQueueStmt.executeUpdateDelete()
                    }
                }

                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_purchases_accessKeyHash ON purchases(accessKeyHash)")
            }
        }

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "meugasto.db"
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7)
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

