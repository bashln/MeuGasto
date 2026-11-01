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

    private val appContext = context.applicationContext

    private val plainPrefs: SharedPreferences =
        appContext.getSharedPreferences("meugasto_settings", Context.MODE_PRIVATE)

    private val securePrefs: SharedPreferences by lazy {
        runCatching { appContext.deleteSharedPreferences("meugasto_secure_fallback") }
        createEncryptedPrefs(appContext).getOrElse {
            runCatching { appContext.deleteSharedPreferences("meugasto_secure_prefs") }
            createEncryptedPrefs(appContext).getOrElse {
                InMemorySharedPreferences()
            }
        }
    }

    private fun createEncryptedPrefs(ctx: Context): Result<SharedPreferences> = runCatching {
        val masterKey = MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            ctx,
            "meugasto_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
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

internal class InMemorySharedPreferences : SharedPreferences {
    private val map = java.util.concurrent.ConcurrentHashMap<String, Any>()

    override fun getAll(): MutableMap<String, *> = HashMap(map)
    override fun getString(key: String?, defValue: String?): String? =
        (key?.let { map[it] } as? String) ?: defValue
    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
        (key?.let { map[it] } as? Set<String>)?.toMutableSet() ?: defValues
    override fun getInt(key: String?, defValue: Int): Int =
        (key?.let { map[it] } as? Int) ?: defValue
    override fun getLong(key: String?, defValue: Long): Long =
        (key?.let { map[it] } as? Long) ?: defValue
    override fun getFloat(key: String?, defValue: Float): Float =
        (key?.let { map[it] } as? Float) ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean): Boolean =
        (key?.let { map[it] } as? Boolean) ?: defValue
    override fun contains(key: String?): Boolean = key != null && map.containsKey(key)

    override fun edit(): SharedPreferences.Editor = object : SharedPreferences.Editor {
        private val staged = LinkedHashMap<String, Any?>()
        private var clearRequested = false

        override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = value
        }
        override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = values?.toSet()
        }
        override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = value
        }
        override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = value
        }
        override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = value
        }
        override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = value
        }
        override fun remove(key: String?): SharedPreferences.Editor = apply {
            if (key != null) staged[key] = null
        }
        override fun clear(): SharedPreferences.Editor = apply { clearRequested = true }
        override fun commit(): Boolean {
            apply()
            return true
        }
        override fun apply() {
            if (clearRequested) map.clear()
            for ((k, v) in staged) {
                if (v == null) map.remove(k) else map[k] = v
            }
        }
    }

    override fun registerOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) = Unit

    override fun unregisterOnSharedPreferenceChangeListener(
        listener: SharedPreferences.OnSharedPreferenceChangeListener?
    ) = Unit
}


