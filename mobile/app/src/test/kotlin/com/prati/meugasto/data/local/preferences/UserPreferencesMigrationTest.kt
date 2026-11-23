package com.prati.meugasto.data.local.preferences

import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UserPreferencesMigrationTest {

    private fun legacy() = InMemorySharedPreferences()
    private fun secure() = InMemorySharedPreferences()

    @Test
    fun `migration copies the three personal fields and clears the legacy store`() {
        val legacy = legacy().apply {
            edit()
                .putString("user_email", "titular@example.com")
                .putString("user_name", "Titular")
                .putString("user_id", "usuario-123")
                .apply()
        }
        val secure = secure()

        PiiMigration.migrate(legacy, secure)

        assertEquals("titular@example.com", secure.getString("user_email", null))
        assertEquals("Titular", secure.getString("user_name", null))
        assertEquals("usuario-123", secure.getString("user_id", null))
        for (key in PiiMigration.legacyKeys) {
            assertNull("valor legado de $key deveria sair do armazenamento em claro", legacy.getString(key, null))
        }
    }

    @Test
    fun `migration leaves unrelated settings untouched`() {
        val legacy = legacy().apply {
            edit().putString("user_email", "titular@example.com").putString("app_mode", "CLOUD").apply()
        }
        val secure = secure()

        PiiMigration.migrate(legacy, secure)

        assertEquals("CLOUD", legacy.getString("app_mode", null))
    }

    @Test
    fun `migration is idempotent`() {
        val legacy = legacy().apply { edit().putString("user_email", "titular@example.com").apply() }
        val secure = secure()

        PiiMigration.migrate(legacy, secure)
        PiiMigration.migrate(legacy, secure)
        PiiMigration.migrate(legacy, secure)

        assertEquals("titular@example.com", secure.getString("user_email", null))
        assertNull(legacy.getString("user_email", null))
    }

    @Test
    fun `migration keeps an existing secure value and still clears the duplicate`() {
        val legacy = legacy().apply { edit().putString("user_email", "antigo@example.com").apply() }
        val secure = secure().apply { edit().putString("user_email", "atual@example.com").apply() }

        PiiMigration.migrate(legacy, secure)

        assertEquals("atual@example.com", secure.getString("user_email", null))
        assertNull(legacy.getString("user_email", null))
    }

    @Test
    fun `migration never deletes a legacy value it could not store`() {
        val legacy = legacy().apply {
            edit()
                .putString("user_email", "titular@example.com")
                .putString("user_name", "Titular")
                .putString("user_id", "usuario-123")
                .apply()
        }
        val secure = ReadOnlySharedPreferences(secure())

        PiiMigration.migrate(legacy, secure)

        assertEquals("titular@example.com", legacy.getString("user_email", null))
        assertEquals("Titular", legacy.getString("user_name", null))
        assertEquals("usuario-123", legacy.getString("user_id", null))
        assertTrue(secure.getAll().isEmpty())
    }
}

/** Store que nega escrita: simula cofre indisponivel sem perder o valor legado. */
private class ReadOnlySharedPreferences(
    delegate: SharedPreferences
) : SharedPreferences by delegate {

    override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
        override fun putString(key: String?, value: String?) = this
        override fun putStringSet(key: String?, values: MutableSet<String>?) = this
        override fun putInt(key: String?, value: Int) = this
        override fun putLong(key: String?, value: Long) = this
        override fun putFloat(key: String?, value: Float) = this
        override fun putBoolean(key: String?, value: Boolean) = this
        override fun remove(key: String?) = this
        override fun clear() = this
        override fun commit(): Boolean = false
        override fun apply() = Unit
    }
}
