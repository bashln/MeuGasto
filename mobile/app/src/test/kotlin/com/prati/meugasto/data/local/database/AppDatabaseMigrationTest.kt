package com.prati.meugasto.data.local.database

import android.database.Cursor
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteStatement
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Test

class AppDatabaseMigrationTest {

    @Test
    fun `migration 5 to 6 cria coluna e popula com canonicalName do runtime`() {
        val db = mockk<SupportSQLiteDatabase>(relaxed = true)
        val cursor = mockk<Cursor>(relaxed = true)
        val statement = mockk<SupportSQLiteStatement>(relaxed = true)

        every { db.query("SELECT id, name, code FROM items") } returns cursor
        every { db.compileStatement("UPDATE items SET canonicalName = ? WHERE id = ?") } returns statement
        every { cursor.moveToNext() } returnsMany listOf(true, true, false)
        every { cursor.getLong(0) } returnsMany listOf(1L, 2L)
        every { cursor.getString(1) } returnsMany listOf("ARROZ 5KG", "Leite Integral")
        every { cursor.isNull(2) } returnsMany listOf(false, true)
        every { cursor.getString(2) } returns " 789123 "

        AppDatabase.MIGRATION_5_6.migrate(db)

        verify { db.execSQL("ALTER TABLE items ADD COLUMN canonicalName TEXT NOT NULL DEFAULT ''") }
        verify { statement.bindString(1, "code:789123"); statement.bindLong(2, 1L) }
        verify { statement.bindString(1, "name:leite integral"); statement.bindLong(2, 2L) }
    }

    @Test
    fun `migration 5 to 6 usa nome quando codigo e vazio`() {
        val db = mockk<SupportSQLiteDatabase>(relaxed = true)
        val cursor = mockk<Cursor>(relaxed = true)
        val statement = mockk<SupportSQLiteStatement>(relaxed = true)

        every { db.query("SELECT id, name, code FROM items") } returns cursor
        every { db.compileStatement("UPDATE items SET canonicalName = ? WHERE id = ?") } returns statement
        every { cursor.moveToNext() } returnsMany listOf(true, false)
        every { cursor.getLong(0) } returns 3L
        every { cursor.getString(1) } returns "SABÃO EM PÓ"
        every { cursor.isNull(2) } returns false
        every { cursor.getString(2) } returns "   "

        AppDatabase.MIGRATION_5_6.migrate(db)

        verify { statement.bindString(1, "name:sabao em po"); statement.bindLong(2, 3L) }
    }

    @Test
    fun `migration 6 to 7 apaga chave em claro de compras ja sincronizadas e indexa o hash`() {
        val db = mockk<SupportSQLiteDatabase>(relaxed = true)
        val cursor = mockk<Cursor>(relaxed = true)
        val setHashStatement = mockk<SupportSQLiteStatement>(relaxed = true)
        val clearKeyStatement = mockk<SupportSQLiteStatement>(relaxed = true)
        val leaveQueueStatement = mockk<SupportSQLiteStatement>(relaxed = true)

        every {
            db.query("SELECT id, accessKey, remoteId, pendingCloudUserId FROM purchases ORDER BY id ASC")
        } returns cursor
        every { db.compileStatement("UPDATE purchases SET accessKeyHash = ? WHERE id = ?") } returns setHashStatement
        every { db.compileStatement("UPDATE purchases SET accessKey = NULL WHERE id = ?") } returns clearKeyStatement
        every {
            db.compileStatement("UPDATE purchases SET pendingCloudUserId = NULL WHERE id = ?")
        } returns leaveQueueStatement
        every { cursor.moveToNext() } returnsMany listOf(true, true, true, false)
        every { cursor.getLong(0) } returnsMany listOf(1L, 2L, 3L)
        every { cursor.isNull(1) } returnsMany listOf(false, true, false)
        every { cursor.getString(1) } returns " abc "
        every { cursor.isNull(2) } returnsMany listOf(false, true, true)
        every { cursor.getLong(2) } returns 90L
        every { cursor.isNull(3) } returnsMany listOf(false, true, false)
        every { cursor.getString(3) } returns "account-1"

        AppDatabase.MIGRATION_6_7.migrate(db)

        verify { db.execSQL("ALTER TABLE purchases ADD COLUMN accessKeyHash TEXT DEFAULT NULL") }
        verify {
            setHashStatement.bindString(
                1,
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
            )
            setHashStatement.executeUpdateDelete()
        }
        verify(exactly = 1) { clearKeyStatement.bindLong(1, 1L) }
        verify(exactly = 1) { clearKeyStatement.bindLong(1, 3L) }
        verify(exactly = 1) { leaveQueueStatement.bindLong(1, 3L) }
        verify(exactly = 0) { leaveQueueStatement.bindLong(1, 1L) }
        verify {
            db.execSQL(
                "CREATE UNIQUE INDEX IF NOT EXISTS index_purchases_accessKeyHash ON purchases(accessKeyHash)"
            )
        }
    }
}
