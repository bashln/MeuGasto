package com.prati.meugasto.data.local.database

import androidx.room.testing.MigrationTestHelper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Migration 6→7 em SQLite real: hash único por chave de acesso, remoção da
 * chave em claro quando a nuvem já não precisa dela, preservação para envio
 * e expulsão de notas duplicadas da fila da nuvem.
 */
@RunWith(AndroidJUnit4::class)
class AccessKeyHashMigrationInstrumentedTest {

    private companion object {
        const val TEST_DB = "migration-6-7-test.db"
        const val SYNCED_KEY = "43260993015006000113651040003070441999999999"
        const val PENDING_KEY = "33260993015006000113651040003070441988887777"
    }

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        AppDatabase::class.java
    )

    @After
    fun tearDown() {
        InstrumentationRegistry.getInstrumentation().targetContext.deleteDatabase(TEST_DB)
    }

    @Test
    fun migrationHashesKeysAndClearsPlaintextOnlyWhenUploadNoLongerNeedsIt() {
        createV6Database()
        val expectedHash = PurchaseAccessKeyHasher.sha256Hex(SYNCED_KEY)

        val db = helper.runMigrationsAndValidate(TEST_DB, 7, true, AppDatabase.MIGRATION_6_7)

        assertEquals(3, count(db, "purchases"))

        db.query(
            "SELECT accessKey, accessKeyHash FROM purchases WHERE id = 10"
        ).use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertNull("chave local não deve ficar em claro", cursor.getString(0))
            assertEquals(expectedHash, cursor.getString(1))
        }

        db.query(
            "SELECT accessKey, accessKeyHash FROM purchases WHERE id = 11"
        ).use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals("chave pendente de envio deve sobreviver", PENDING_KEY, cursor.getString(0))
            assertNotNull(cursor.getString(1))
        }

        db.query(
            "SELECT accessKey, accessKeyHash, pendingCloudUserId FROM purchases WHERE id = 12"
        ).use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertNull("chave repetida não pode violar o índice único", cursor.getString(1))
            assertNull("chave repetida não deve ficar em claro", cursor.getString(0))
            assertNull("nota duplicada sai da fila da nuvem", cursor.getString(2))
        }

        db.query("PRAGMA index_list(purchases)").use { cursor ->
            var foundUniqueIndex = false
            while (cursor.moveToNext()) {
                if (cursor.getString(1) == "index_purchases_accessKeyHash" && cursor.getInt(2) == 1) {
                    foundUniqueIndex = true
                }
            }
            assertTrue("índice único de accessKeyHash ausente", foundUniqueIndex)
        }
    }

    private fun createV6Database() {
        helper.createDatabase(TEST_DB, 6).use { db ->
            db.execSQL(
                "INSERT INTO supermarkets (id, name, cnpj, city, state, type, isManual, createdAt, remoteId) " +
                    "VALUES (1, 'Zaffari', '92.016.757/0073-66', 'Porto Alegre', 'RS', 'SUPERMARKET', 0, '2026-08-01', NULL)"
            )
            insertPurchase(db, id = 10L, key = SYNCED_KEY, remoteId = 900L, pendingUserId = null)
            insertPurchase(db, id = 11L, key = PENDING_KEY, remoteId = null, pendingUserId = "account-1")
            insertPurchase(db, id = 12L, key = PENDING_KEY, remoteId = null, pendingUserId = "account-1")
        }
    }

    private fun insertPurchase(
        db: androidx.sqlite.db.SupportSQLiteDatabase,
        id: Long,
        key: String,
        remoteId: Long?,
        pendingUserId: String?
    ) {
        db.execSQL(
            "INSERT INTO purchases (id, supermarketId, date, totalPrice, isManual, createdAt, updatedAt, remoteId, accessKey, pendingCloudUserId) " +
                "VALUES (?, 1, '2026-08-01', 57.48, 0, '2026-08-01', '2026-08-01', ?, ?, ?)",
            arrayOf<Any?>(id, remoteId, key, pendingUserId)
        )
    }

    private fun count(db: androidx.sqlite.db.SupportSQLiteDatabase, table: String): Int =
        db.query("SELECT COUNT(*) FROM $table").use { cursor ->
            cursor.moveToFirst()
            cursor.getInt(0)
        }
}
