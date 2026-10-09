package com.prati.meugasto.data.remote.supabase

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

open class SupabaseException(message: String, val statusCode: Int = 0) : Exception(message)

/**
 * Erro de credencial (HTTP 400/401 no endpoint de token). Usado para mostrar uma
 * mensagem genérica ao utilizador sem revelar se o e-mail existe.
 */
class SupabaseAuthException(message: String, statusCode: Int = 0) : SupabaseException(message, statusCode)

@Serializable
data class RemoteUser(
    val id: String,
    val email: String? = null,
    @SerialName("user_metadata") val userMetadata: JsonObject? = null
)

@Serializable
data class RemoteAuthSession(
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("refresh_token") val refreshToken: String? = null,
    val user: RemoteUser? = null
)

@Serializable
data class RemoteSupermarket(
    val id: Long,
    val name: String,
    val cnpj: String? = null,
    val city: String? = null,
    val state: String? = null,
    val manual: Boolean = false
)

@Serializable
data class RemoteItem(
    val id: Long,
    val name: String,
    val code: String? = null,
    @SerialName("category_id") val categoryId: Int? = null,
    val quantity: Double = 1.0,
    val unit: String? = null,
    val price: Double = 0.0
)

@Serializable
data class RemotePurchase(
    val id: Long,
    val date: String,
    @SerialName("total_price") val totalPrice: Double = 0.0,
    val manual: Boolean = false,
    val supermarket: RemoteSupermarket? = null,
    val items: List<RemoteItem> = emptyList(),
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
private data class EmailCredentials(val email: String, val password: String)

@Serializable
private data class SignUpRequest(
    val email: String,
    val password: String,
    val data: JsonObject? = null
)

/**
 * Cliente REST mínimo para Supabase (GoTrue + PostgREST). Feito sobre Ktor para
 * manter o controlo do payload e permitir testes com um engine falso.
 */
class SupabaseApi(
    private val baseUrl: String,
    private val anonKey: String,
    private val client: HttpClient = defaultHttpClient()
) {

    val isConfigured: Boolean
        get() = baseUrl.isNotBlank() &&
            anonKey.isNotBlank() &&
            !baseUrl.contains("placeholder", ignoreCase = true)

    suspend fun signIn(email: String, password: String): RemoteAuthSession {
        val response = client.post("$baseUrl/auth/v1/token") {
            parameter("grant_type", "password")
            header("apikey", anonKey)
            contentType(ContentType.Application.Json)
            setBody(EmailCredentials(email.trim(), password))
        }
        return response.decodeOrThrow()
    }

    /** Devolve a sessão criada. `null` quando o projeto exige confirmação de e-mail. */
    suspend fun signUp(email: String, password: String, name: String?): RemoteAuthSession? {
        val data = name?.takeIf { it.isNotBlank() }?.let {
            JsonObject(mapOf("name" to kotlinx.serialization.json.JsonPrimitive(it)))
        }
        val response = client.post("$baseUrl/auth/v1/signup") {
            header("apikey", anonKey)
            contentType(ContentType.Application.Json)
            setBody(SignUpRequest(email.trim(), password, data))
        }
        if (!response.status.isSuccess()) throw response.toException(auth = true)
        val session = response.body<RemoteAuthSession>()
        return if (session.accessToken.isNullOrBlank()) null else session
    }

    suspend fun refresh(refreshToken: String): RemoteAuthSession {
        val response = client.post("$baseUrl/auth/v1/token") {
            parameter("grant_type", "refresh_token")
            header("apikey", anonKey)
            contentType(ContentType.Application.Json)
            setBody(kotlinx.serialization.json.buildJsonObject {
                put("refresh_token", kotlinx.serialization.json.JsonPrimitive(refreshToken))
            })
        }
        return response.decodeOrThrow()
    }

    suspend fun fetchPurchases(accessToken: String): List<RemotePurchase> {
        val response = client.get("$baseUrl/rest/v1/purchases") {
            header("apikey", anonKey)
            header("Authorization", "Bearer $accessToken")
            parameter("select", PURCHASE_SELECT)
            parameter("order", "date.desc")
        }
        if (!response.status.isSuccess()) throw response.toException(auth = response.status == HttpStatusCode.Unauthorized)
        return response.body()
    }

    private suspend inline fun <reified T> HttpResponse.decodeOrThrow(): T {
        if (!status.isSuccess()) throw toException(auth = status == HttpStatusCode.Unauthorized || status == HttpStatusCode.BadRequest)
        return body()
    }

    private suspend fun HttpResponse.toException(auth: Boolean): SupabaseException {
        val text = runCatching { bodyAsText() }.getOrDefault("")
        val message = parseErrorMessage(text)
        return if (auth) SupabaseAuthException(message, status.value)
        else SupabaseException(message, status.value)
    }

    private fun parseErrorMessage(raw: String): String {
        if (raw.isBlank()) return "Falha na comunicação com o servidor."
        return runCatching {
            json.decodeFromString(ErrorEnvelope.serializer(), raw).message()
        }.getOrDefault(raw.take(300))
    }

    @Serializable
    private data class ErrorEnvelope(
        val message: String? = null,
        @SerialName("error_description") val errorDescription: String? = null,
        val msg: String? = null,
        @SerialName("error") val error: String? = null
    ) {
        fun message(): String = message ?: errorDescription ?: msg ?: error ?: "Erro desconhecido."
    }

    companion object {
        private const val PURCHASE_SELECT =
            "id,date,total_price,manual,created_at,updated_at," +
                "supermarket:supermarkets(id,name,cnpj,city,state,manual)," +
                "items(id,name,code,category_id,quantity,unit,price)"

        internal val json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            coerceInputValues = true
        }

        private fun HttpStatusCode.isSuccess(): Boolean = value in 200..299

        fun defaultHttpClient(): HttpClient = HttpClient(OkHttp) {
            install(ContentNegotiation) { json(json) }
        }
    }
}
