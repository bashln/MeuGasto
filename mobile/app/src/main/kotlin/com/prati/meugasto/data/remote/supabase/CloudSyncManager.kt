package com.prati.meugasto.data.remote.supabase

/**
 * Orquestra a sincronização: busca as compras no Supabase e espelha na Room.
 * Renova a sessão uma vez quando o token expira.
 */
class CloudSyncManager(
    private val api: SupabaseApi,
    private val auth: SupabaseAuthRepository,
    private val sync: CloudPurchaseSync
) {

    suspend fun syncNow(): Result<Int> = runCatching {
        val token = auth.currentAccessToken()
            ?: throw SupabaseAuthException("Sessão expirada. Entre novamente.")
        try {
            sync.sync(api.fetchPurchases(token))
        } catch (e: SupabaseAuthException) {
            if (!auth.refreshSession()) throw e
            val refreshed = auth.currentAccessToken()
                ?: throw SupabaseAuthException("Sessão expirada. Entre novamente.")
            sync.sync(api.fetchPurchases(refreshed))
        }
    }
}
