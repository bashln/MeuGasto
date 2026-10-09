package com.prati.meugasto.data.remote.supabase

import androidx.room.withTransaction
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.PurchaseWithSupermarketAndItems
import com.prati.meugasto.data.local.database.SupermarketEntity
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Envia para o Supabase uma compra guardada localmente e grava de volta o
 * `remoteId` das linhas criadas, para que a sincronização não as duplique.
 */
class CloudPurchaseUploader(
    private val api: SupabaseApi,
    private val auth: SupabaseAuthRepository,
    private val database: AppDatabase
) {

    suspend fun upload(localPurchaseId: Long): Result<Long> = runCatching {
        val detail = database.purchaseDao().getById(localPurchaseId)
            ?: throw SupabaseException("Compra local não encontrada.")
        val userId = (auth.state.value as? AuthState.LoggedIn)?.userId
            ?: throw SupabaseAuthException("Entre na conta para enviar compras.")
        val token = auth.currentAccessToken()
            ?: throw SupabaseAuthException("Sessão expirada. Entre novamente.")

        try {
            uploadWithToken(token, userId, localPurchaseId, detail)
        } catch (e: SupabaseAuthException) {
            if (!auth.refreshSession()) throw e
            val refreshed = auth.currentAccessToken() ?: throw e
            uploadWithToken(refreshed, userId, localPurchaseId, detail)
        }
    }

    private suspend fun uploadWithToken(
        token: String,
        userId: String,
        localPurchaseId: Long,
        detail: PurchaseWithSupermarketAndItems
    ): Long {
        val marketId = ensureSupermarket(token, userId, detail.supermarket)
        val remotePurchaseId = api.insertReturningId(
            token,
            "purchases",
            purchaseBody(userId, marketId, detail.purchase)
        )
        api.insertItems(token, itemsBody(remotePurchaseId, detail.items))
        database.purchaseDao().setRemoteId(localPurchaseId, remotePurchaseId)
        return remotePurchaseId
    }

    private suspend fun ensureSupermarket(
        token: String,
        userId: String,
        market: SupermarketEntity
    ): Long {
        market.remoteId?.let { return it }
        val remoteId = api.insertReturningId(
            token,
            "supermarkets",
            buildJsonObject {
                put("user_id", JsonPrimitive(userId))
                put("name", JsonPrimitive(market.name))
                put("cnpj", market.cnpj.orNull())
                put("city", market.city.orNull())
                put("state", market.state.orNull())
                put("manual", JsonPrimitive(market.isManual))
            }
        )
        database.supermarketDao().setRemoteId(market.id, remoteId)
        return remoteId
    }

    private fun purchaseBody(userId: String, marketId: Long, purchase: PurchaseEntity): JsonObject =
        buildJsonObject {
            put("user_id", JsonPrimitive(userId))
            put("supermarket_id", JsonPrimitive(marketId))
            put("date", JsonPrimitive(normalizeDate(purchase.date)))
            put("total_price", JsonPrimitive(purchase.totalPrice))
            put("manual", JsonPrimitive(purchase.isManual))
        }

    /**
     * O PostgREST rejeita lotes com chaves diferentes entre objetos, então todos
     * os itens levam as mesmas chaves, com `null` explícito quando vazio.
     */
    private fun itemsBody(purchaseId: Long, items: List<ItemEntity>): JsonArray =
        JsonArray(items.map { item ->
            buildJsonObject {
                put("purchase_id", JsonPrimitive(purchaseId))
                put("name", JsonPrimitive(item.name))
                put("code", item.code.orNull())
                put("category_id", item.categoryId?.let { JsonPrimitive(it) } ?: JsonNull)
                put("quantity", JsonPrimitive(item.quantity))
                put("unit", JsonPrimitive(item.unit))
                put("price", JsonPrimitive(item.price))
            }
        })

    private fun String?.orNull() = this?.let { JsonPrimitive(it) } ?: JsonNull

    private fun normalizeDate(date: String): String {
        val br = Regex("^(\\d{2})/(\\d{2})/(\\d{4})$").find(date.trim())
        return if (br != null) {
            "${br.groupValues[3]}-${br.groupValues[2]}-${br.groupValues[1]}"
        } else {
            date.trim().take(10)
        }
    }
}
