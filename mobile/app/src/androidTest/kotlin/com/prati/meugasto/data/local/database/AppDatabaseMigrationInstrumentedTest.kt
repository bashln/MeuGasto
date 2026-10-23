package com.prati.meugasto.data.local.database

import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Valida a migration 5→6 em SQLite real: schema esperado pelo Room,
 * backfill semântico e preservação integral dos dados existentes.
 */
@RunWith(AndroidJUnit4::class)
class AppDatabaseMigrationInstrumentedTest {

    private companion object {
        const val TEST_DB = "migration-5-6-test.db"
        const val ACCESS_KEY = "43260993015006000113651040003070441999999999"
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
    fun `migration valida schema e preserva compras itens e relacionamentos`() {
        createV5DatabaseWithRealisticRows()

        val db = helper.runMigrationsAndValidate(TEST_DB, 6, true, AppDatabase.MIGRATION_5_6)

        assertEquals(1, count(db, "supermarkets"))
        assertEquals(1, count(db, "purchases"))
        assertEquals(3, count(db, "items"))

        db.query(
            "SELECT totalPrice, date, accessKey, pendingCloudUserId FROM purchases WHERE id = 10"
        ).use { cursor ->
            assertTrue(cursor.moveToFirst())
            assertEquals(57.48, cursor.getDouble(0), 0.001)
            assertEquals("2026-08-01", cursor.getString(1))
            assertEquals(ACCESS_KEY, cursor.getString(2))
            assertNull(cursor.getString(3))
        }

        db.query(
            "SELECT purchaseId, name, code, categoryId, quantity, unit, price, remoteId, canonicalName " +
                "FROM items ORDER BY id"
        ).use { cursor ->
            assertTrue(cursor.moveToFirst())

            assertEquals(10L, cursor.getLong(0))
            assertEquals("LEITE ELEGE 1L UHT INT", cursor.getString(1))
            assertEquals(" 789123 ", cursor.getString(2))
            assertEquals(7, cursor.getInt(3))
            assertEquals(12.0, cursor.getDouble(4), 0.001)
            assertEquals("UN", cursor.getString(5))
            assertEquals(57.48, cursor.getDouble(6), 0.001)
            assertNull(cursor.getString(7))
            assertEquals("code:789123", cursor.getString(8))

            assertTrue(cursor.moveToNext())
            assertEquals("PAPEL HIG NOTAVEL 30M", cursor.getString(1))
            assertEquals("", cursor.getString(2))
            assertEquals("name:papel hig notavel 30m", cursor.getString(8))

            assertTrue(cursor.moveToNext())
            assertEquals("SABÃO EM PÓ", cursor.getString(1))
            assertNull(cursor.getString(2))
            assertEquals("name:sabao em po", cursor.getString(8))
        }

        // Nenhuma linha órfã e nenhuma FK quebrada após a migration.
        db.query("PRAGMA foreign_key_check").use { cursor ->
            assertTrue("foreign_key_check encontrou violações", !cursor.moveToFirst())
        }
    }

    @Test
    fun `migration em banco vazio produz schema v6 valido`() {
        helper.createDatabase(TEST_DB, 5).close()

        val db = helper.runMigrationsAndValidate(TEST_DB, 6, true, AppDatabase.MIGRATION_5_6)

        assertEquals(0, count(db, "items"))
    }

    private fun createV5DatabaseWithRealisticRows() {
        helper.createDatabase(TEST_DB, 5).use { db ->
            db.execSQL(
                "INSERT INTO supermarkets (id, name, cnpj, city, state, type, isManual, createdAt, remoteId) " +
                    "VALUES (1, 'Zaffari', '92.016.757/0073-66', 'Porto Alegre', 'RS', 'SUPERMARKET', 0, '2026-08-01', NULL)"
            )
            db.execSQL(
                "INSERT INTO purchases (id, supermarketId, date, totalPrice, isManual, createdAt, updatedAt, remoteId, accessKey, pendingCloudUserId) " +
                    "VALUES (10, 1, '2026-08-01', 57.48, 0, '2026-08-01', '2026-08-01', NULL, ?, NULL)",
                arrayOf(ACCESS_KEY)
            )
            db.execSQL(
                "INSERT INTO items (id, purchaseId, name, code, categoryId, quantity, unit, price, remoteId) " +
                    "VALUES (100, 10, 'LEITE ELEGE 1L UHT INT', ' 789123 ', 7, 12.0, 'UN', 57.48, NULL)"
            )
            db.execSQL(
                "INSERT INTO items (id, purchaseId, name, code, categoryId, quantity, unit, price, remoteId) " +
                    "VALUES (101, 10, 'PAPEL HIG NOTAVEL 30M', '', 7, 2.0, 'UN', 77.80, NULL)"
            )
            db.execSQL(
                "INSERT INTO items (id, purchaseId, name, code, categoryId, quantity, unit, price, remoteId) " +
                    "VALUES (102, 10, 'SABÃO EM PÓ', NULL, NULL, 1.0, 'UN', 31.99, NULL)"
            )
            db.execSQL(
                "INSERT INTO shopping_lists (id, userId, name, status, createdAt, updatedAt) " +
                    "VALUES (1, NULL, 'Minha Lista', 'active', '2026-08-01', '2026-08-01')"
            )
            db.execSQL(
                "INSERT INTO shopping_list_items (id, shoppingListId, name, quantity, unit, estimatedPrice, createdAt) " +
                    "VALUES (1, 1, 'Leite', 2.0, 'UN', 4.79, '2026-08-01')"
            )
        }
    }

    private fun count(db: SupportSQLiteDatabase, table: String): Int =
        db.query("SELECT COUNT(*) FROM $table").use { cursor ->
            cursor.moveToFirst()
            cursor.getInt(0)
        }
}
