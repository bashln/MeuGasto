package com.prati.meugasto.data.local.preferences

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.prati.meugasto.domain.model.AppMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeMode {
    LIGHT,
    DARK,
    SYSTEM
}

/** Superfície mínima de sessão usada pelo repositório de nuvem. */
interface AuthPreferences {
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    fun getAppMode(): AppMode
    fun setAppMode(mode: AppMode)
    fun saveAuthTokens(accessToken: String, refreshToken: String)
    fun saveUserEmail(email: String)
    fun getUserEmail(): String?
    fun saveUserName(name: String)
    fun getUserName(): String?
    fun saveUserId(id: String)
    fun getUserId(): String?
    fun clearAuth()
}

class UserPreferences(context: Context) : AuthPreferences {

    private val plainPrefs: SharedPreferences =
        context.getSharedPreferences("meugasto_settings", Context.MODE_PRIVATE)

    private val securePrefs: SharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                "meugasto_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (_: Exception) {
            // Fallback para dispositivos onde KeyStore falhar
            context.getSharedPreferences("meugasto_secure_fallback", Context.MODE_PRIVATE)
        }
    }

    private val _appMode = MutableStateFlow(getAppMode())
    val appMode: StateFlow<AppMode> = _appMode.asStateFlow()

    private val _themeMode = MutableStateFlow(getThemeMode())
    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    override fun getAppMode(): AppMode {
        val modeStr = plainPrefs.getString("app_mode", AppMode.LOCAL_FIRST.name)
        return try {
            AppMode.valueOf(modeStr ?: AppMode.LOCAL_FIRST.name)
        } catch (_: Exception) {
            AppMode.LOCAL_FIRST
        }
    }

    override fun setAppMode(mode: AppMode) {
        plainPrefs.edit().putString("app_mode", mode.name).apply()
        _appMode.value = mode
    }

    fun getThemeMode(): ThemeMode {
        val modeStr = plainPrefs.getString("theme_mode", ThemeMode.LIGHT.name)
        return try {
            ThemeMode.valueOf(modeStr ?: ThemeMode.LIGHT.name)
        } catch (_: Exception) {
            ThemeMode.LIGHT
        }
    }

    fun setThemeMode(mode: ThemeMode) {
        plainPrefs.edit().putString("theme_mode", mode.name).apply()
        _themeMode.value = mode
    }

    fun isOnboardingCompleted(): Boolean {
        return plainPrefs.getBoolean("onboarding_completed", false)
    }

    fun setOnboardingCompleted(completed: Boolean) {
        plainPrefs.edit().putBoolean("onboarding_completed", completed).apply()
    }

    // Supabase Auth tokens & Account
    override fun saveAuthTokens(accessToken: String, refreshToken: String) {
        securePrefs.edit()
            .putString("access_token", accessToken)
            .putString("refresh_token", refreshToken)
            .apply()
    }

    override fun getAccessToken(): String? = securePrefs.getString("access_token", null)
    override fun getRefreshToken(): String? = securePrefs.getString("refresh_token", null)

    override fun saveUserEmail(email: String) {
        plainPrefs.edit().putString("user_email", email).apply()
    }

    override fun getUserEmail(): String? = plainPrefs.getString("user_email", null)

    override fun saveUserName(name: String) {
        plainPrefs.edit().putString("user_name", name).apply()
    }

    override fun getUserName(): String? = plainPrefs.getString("user_name", null)

    override fun saveUserId(id: String) {
        plainPrefs.edit().putString("user_id", id).apply()
    }

    override fun getUserId(): String? = plainPrefs.getString("user_id", null)

    override fun clearAuth() {
        securePrefs.edit().remove("access_token").remove("refresh_token").apply()
        plainPrefs.edit().remove("user_email").remove("user_name").remove("user_id").apply()
    }

    // WebDAV config
    fun saveWebDavConfig(url: String, user: String, pass: String) {
        securePrefs.edit()
            .putString("webdav_url", url)
            .putString("webdav_user", user)
            .putString("webdav_pass", pass)
            .apply()
    }

    fun getWebDavUrl(): String? = securePrefs.getString("webdav_url", null)
    fun getWebDavUser(): String? = securePrefs.getString("webdav_user", null)
    fun getWebDavPass(): String? = securePrefs.getString("webdav_pass", null)
}

