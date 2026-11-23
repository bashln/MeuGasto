package com.prati.meugasto.data.local.preferences

import android.content.SharedPreferences

/**
 * Migra dados pessoais que versoes anteriores gravavam em claro.
 *
 * Copia antes de apagar: se o armazenamento seguro nao aceitar a escrita, o
 * valor original continua no armazenamento legado. Reexecutar sem chaves
 * legadas nao muda nada.
 */
internal object PiiMigration {

    val legacyKeys = listOf("user_email", "user_name", "user_id")

    fun migrate(legacy: SharedPreferences, secure: SharedPreferences) {
        for (key in legacyKeys) {
            val value = legacy.getString(key, null) ?: continue
            if (secure.getString(key, null) == null) {
                secure.edit().putString(key, value).commit()
            }
            if (secure.getString(key, null) != null) {
                legacy.edit().remove(key).commit()
            }
        }
    }
}
