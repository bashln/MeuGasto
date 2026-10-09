package com.prati.meugasto.data.remote.supabase

import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupabaseAuthRepositoryTest {

    private fun prefsLoggedOut(mode: AppMode): UserPreferences {
        val prefs = mockk<UserPreferences>(relaxed = true)
        every { prefs.getAccessToken() } returns null
        every { prefs.getUserId() } returns null
        every { prefs.getAppMode() } returns mode
        return prefs
    }

    @Test
    fun `modo nuvem sem sessao valida volta para local`() {
        val prefs = prefsLoggedOut(AppMode.CLOUD)

        SupabaseAuthRepository(mockk(relaxed = true), prefs)

        verify { prefs.setAppMode(AppMode.LOCAL_FIRST) }
    }

    @Test
    fun `modo local sem sessao permanece local`() {
        val prefs = prefsLoggedOut(AppMode.LOCAL_FIRST)

        SupabaseAuthRepository(mockk(relaxed = true), prefs)

        verify(exactly = 0) { prefs.setAppMode(any()) }
    }

    @Test
    fun `signIn guarda sessao e ativa o modo nuvem`() = runTest {
        val prefs = prefsLoggedOut(AppMode.LOCAL_FIRST)
        val api = mockk<SupabaseApi>(relaxed = true)
        coEvery { api.signIn("ana@example.com", "segredo123") } returns RemoteAuthSession(
            accessToken = "access-123",
            refreshToken = "refresh-456",
            user = RemoteUser(
                id = "user-1",
                email = "ana@example.com",
                userMetadata = buildJsonObject { put("name", JsonPrimitive("Ana")) }
            )
        )

        val repository = SupabaseAuthRepository(api, prefs)
        val result = repository.signIn("ana@example.com", "segredo123")

        assertTrue(result.isSuccess)
        verify { prefs.saveAuthTokens("access-123", "refresh-456") }
        verify { prefs.saveUserId("user-1") }
        verify { prefs.saveUserEmail("ana@example.com") }
        verify { prefs.saveUserName("Ana") }
        verify { prefs.setAppMode(AppMode.CLOUD) }
        assertEquals("user-1", (repository.state.value as AuthState.LoggedIn).userId)
    }

    @Test
    fun `signOut limpa sessao e volta para local`() {
        val prefs = mockk<UserPreferences>(relaxed = true)
        every { prefs.getAccessToken() } returns null
        every { prefs.getUserId() } returns null
        every { prefs.getAppMode() } returns AppMode.LOCAL_FIRST
        val repository = SupabaseAuthRepository(mockk(relaxed = true), prefs)

        repository.signOut()

        verify { prefs.clearAuth() }
        verify { prefs.setAppMode(AppMode.LOCAL_FIRST) }
        assertEquals(AuthState.LoggedOut, repository.state.value)
    }
}
