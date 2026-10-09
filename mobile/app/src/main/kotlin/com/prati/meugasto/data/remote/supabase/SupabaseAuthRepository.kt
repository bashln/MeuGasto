package com.prati.meugasto.data.remote.supabase

import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

sealed interface AuthState {
    data object LoggedOut : AuthState
    data class LoggedIn(val userId: String, val email: String?, val name: String?) : AuthState
}

/**
 * Sessão de conta na nuvem. Guardar a sessão equivale a "estar conectado":
 * não existe um passo separado de conectar a nuvem.
 */
class SupabaseAuthRepository(
    private val api: SupabaseApi,
    private val preferences: UserPreferences
) {

    private val _state = MutableStateFlow(currentState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        // Modo nuvem sem sessão válida é um estado inconsistente: volta para local.
        if (_state.value is AuthState.LoggedOut && preferences.getAppMode() == AppMode.CLOUD) {
            preferences.setAppMode(AppMode.LOCAL_FIRST)
        }
    }

    val isConfigured: Boolean get() = api.isConfigured

    suspend fun signIn(email: String, password: String): Result<AuthState.LoggedIn> = runCatching {
        persist(api.signIn(email, password))
    }

    suspend fun signUp(email: String, password: String, name: String?): Result<AuthState.LoggedIn> = runCatching {
        val session = api.signUp(email, password, name)
            ?: throw SupabaseAuthException("Confirme seu e-mail para ativar a conta.")
        persist(session)
    }

    fun signOut() {
        preferences.clearAuth()
        preferences.setAppMode(AppMode.LOCAL_FIRST)
        _state.value = AuthState.LoggedOut
    }

    fun currentAccessToken(): String? = preferences.getAccessToken()

    /** Renova a sessão com o refresh token guardado. */
    suspend fun refreshSession(): Boolean = runCatching {
        val refreshToken = preferences.getRefreshToken() ?: return@runCatching false
        persist(api.refresh(refreshToken))
        true
    }.getOrDefault(false)

    private fun persist(session: RemoteAuthSession): AuthState.LoggedIn {
        val access = session.accessToken?.takeIf { it.isNotBlank() }
            ?: throw SupabaseAuthException("Sessão inválida recebida do servidor.")
        val refresh = session.refreshToken.orEmpty()
        preferences.saveAuthTokens(access, refresh)

        val user = session.user
        val email = user?.email
        val name = user?.userMetadata?.get("name")
            ?.let { (it as? JsonPrimitive)?.contentOrNull }
            ?.takeIf { it.isNotBlank() }

        if (user != null) preferences.saveUserId(user.id)
        if (email != null) preferences.saveUserEmail(email)
        if (name != null) preferences.saveUserName(name)

        preferences.setAppMode(AppMode.CLOUD)

        return AuthState.LoggedIn(
            userId = user?.id ?: preferences.getUserId().orEmpty(),
            email = email ?: preferences.getUserEmail(),
            name = name ?: preferences.getUserName()
        ).also { _state.value = it }
    }

    private fun currentState(): AuthState {
        val userId = preferences.getUserId()
        val hasToken = !preferences.getAccessToken().isNullOrBlank()
        return if (hasToken && userId != null) {
            AuthState.LoggedIn(userId, preferences.getUserEmail(), preferences.getUserName())
        } else {
            AuthState.LoggedOut
        }
    }
}
