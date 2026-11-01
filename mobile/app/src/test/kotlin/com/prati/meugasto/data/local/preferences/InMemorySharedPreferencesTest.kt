package com.prati.meugasto.data.local.preferences

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InMemorySharedPreferencesTest {

    @Test
    fun `stores removes and clears ephemeral tokens without disk persistence`() {
        val prefs = InMemorySharedPreferences()

        prefs.edit()
            .putString("access_token", "jwt-access")
            .putString("refresh_token", "jwt-refresh")
            .apply()

        assertTrue(prefs.contains("access_token"))
        assertEquals("jwt-access", prefs.getString("access_token", null))
        assertEquals("jwt-refresh", prefs.getString("refresh_token", null))

        prefs.edit().remove("access_token").apply()
        assertFalse(prefs.contains("access_token"))
        assertNull(prefs.getString("access_token", null))
        assertEquals("jwt-refresh", prefs.getString("refresh_token", null))

        prefs.edit().clear().commit()
        assertNull(prefs.getString("refresh_token", null))
    }
}
