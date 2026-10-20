package com.prati.meugasto.data.remote.supabase

import com.prati.meugasto.data.repository.RemotePurchaseDeleter

class CloudPurchaseDeleter(
    private val api: SupabaseApi,
    private val auth: SupabaseAuthRepository
) : RemotePurchaseDeleter {
    override suspend fun delete(remoteId: Long) {
        val token = auth.currentAccessToken()
            ?: throw SupabaseAuthException("Sessão expirada. Entre novamente.")

        try {
            api.deletePurchase(token, remoteId)
        } catch (error: SupabaseAuthException) {
            if (!auth.refreshSession()) throw error
            val refreshedToken = auth.currentAccessToken() ?: throw error
            api.deletePurchase(refreshedToken, remoteId)
        }
    }
}
