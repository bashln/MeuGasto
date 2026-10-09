package com.prati.meugasto.data.remote.supabase

import com.prati.meugasto.data.local.preferences.AuthPreferences
import com.prati.meugasto.domain.model.AppMode
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SupabaseAuthRepositoryTest {

    private class FakePrefs(
        private var accessToken: String? = null,
        private var userId: String? = null,
        private var mode: AppMode = AppMode.LOCAL_FIRST
    ) : AuthPreferences {
        var appModeSet: AppMode? = null
        var savedTokens: Pair<String, String>? = null
        var email: String? = null
        var name: String? = null
        var cleared = false

        override fun getAccessToken() = accessToken
        override fun getRefreshToken() = null
        override fun getAppMode() = mode
        override fun setAppMode(mode: AppMode) {
            this.mode = mode
            appModeSet = mode
        }
        override fun saveAuthTokens(accessToken: String, refreshToken: String) {
            this.accessToken = accessToken
            savedTokens = accessToken to refreshToken
        }
        override fun saveUserEmail(email: String) { this.email = email }
        override fun getUserEmail() = email
        override fun saveUserName(name: String) { this.name = name }
        override fun getUserName() = name
        override fun saveUserId(id: String) { userId = id }
        override fun getUserId() = userId
        override fun clearAuth() {
            accessToken = null
            userId = null
            email = null
            name = null
            cleared = true
        }
    }

    private fun apiReturningSession(): SupabaseApi {
        val engine = MockEngine {
            respond(
                content = """{"access_token":"access-123","refresh_token":"refresh-456",
                    "user":{"id":"user-1","email":"ana@example.com","user_metadata":{"name":"Ana"}}}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
        val client = HttpClient(engine) { install(ContentNegotiation) { json(SupabaseApi.json) } }
        return SupabaseApi("https://proj.supabase.co", "anon-key", client)
    }

    private fun apiReturningSessionWithoutUser(): SupabaseApi {
        val engine = MockEngine {
            respond(
                content = """{"access_token":"access-123","refresh_token":"refresh-456"}""",
                status = HttpStatusCode.OK,
                headers = headersOf(HttpHeaders.ContentType, "application/json")
            )
        }
        val client = HttpClient(engine) { install(ContentNegotiation) { json(SupabaseApi.json) } }
        return SupabaseApi("https://proj.supabase.co", "anon-key", client)
    }

    @Test
    fun `signIn sem user na resposta falha em vez de ficar meio-logado`() = runTest {
        val prefs = FakePrefs(mode = AppMode.LOCAL_FIRST)
        val repository = SupabaseAuthRepository(apiReturningSessionWithoutUser(), prefs)

        val result = repository.signIn("ana@example.com", "segredo123")

        assertTrue(result.isFailure)
        assertEquals(AuthState.LoggedOut, repository.state.value)
    }

    @Test
    fun `modo nuvem sem sessao valida volta para local`() {
        val prefs = FakePrefs(mode = AppMode.CLOUD)

        SupabaseAuthRepository(apiReturningSession(), prefs)

        assertEquals(AppMode.LOCAL_FIRST, prefs.appModeSet)
    }

    @Test
    fun `modo local sem sessao permanece local`() {
        val prefs = FakePrefs(mode = AppMode.LOCAL_FIRST)

        SupabaseAuthRepository(apiReturningSession(), prefs)

        assertNull(prefs.appModeSet)
    }

    @Test
    fun `signIn guarda sessao e ativa o modo nuvem`() = runTest {
        val prefs = FakePrefs(mode = AppMode.LOCAL_FIRST)
        val repository = SupabaseAuthRepository(apiReturningSession(), prefs)

        val result = repository.signIn("ana@example.com", "segredo123")

        assertTrue(result.isSuccess)
        assertEquals("access-123" to "refresh-456", prefs.savedTokens)
        assertEquals("user-1", prefs.getUserId())
        assertEquals("ana@example.com", prefs.getUserEmail())
        assertEquals("Ana", prefs.getUserName())
        assertEquals(AppMode.CLOUD, prefs.appModeSet)
        assertEquals("user-1", (repository.state.value as AuthState.LoggedIn).userId)
    }

    @Test
    fun `signOut limpa sessao e volta para local`() {
        val prefs = FakePrefs(accessToken = "tok", userId = "user-1", mode = AppMode.CLOUD)
        val repository = SupabaseAuthRepository(apiReturningSession(), prefs)

        repository.signOut()

        assertTrue(prefs.cleared)
        assertEquals(AppMode.LOCAL_FIRST, prefs.appModeSet)
        assertEquals(AuthState.LoggedOut, repository.state.value)
    }
}
