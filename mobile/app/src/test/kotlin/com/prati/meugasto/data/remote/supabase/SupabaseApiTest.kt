package com.prati.meugasto.data.remote.supabase

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupabaseApiTest {

    private fun client(engine: MockEngine) = HttpClient(engine) {
        install(ContentNegotiation) { json(SupabaseApi.json) }
    }

    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")

    @Test
    fun `signIn envia credenciais e apikey e devolve sessao`() = runTest {
        var capturedPath = ""
        var capturedGrant = ""
        var capturedApiKey = ""
        var capturedBody = ""

        val engine = MockEngine { request ->
            capturedPath = request.url.encodedPath
            capturedGrant = request.url.parameters["grant_type"].orEmpty()
            capturedApiKey = request.headers["apikey"].orEmpty()
            capturedBody = (request.body as? TextContent)?.text.orEmpty()
            respond(
                content = """
                    {"access_token":"access-123","refresh_token":"refresh-456",
                     "user":{"id":"user-1","email":"ana@example.com","user_metadata":{"name":"Ana"}}}
                """.trimIndent(),
                status = HttpStatusCode.OK,
                headers = jsonHeaders
            )
        }

        val api = SupabaseApi("https://proj.supabase.co", "anon-key", client(engine))
        val session = api.signIn("ana@example.com", "segredo123")

        assertEquals("/auth/v1/token", capturedPath)
        assertEquals("password", capturedGrant)
        assertEquals("anon-key", capturedApiKey)
        assertTrue(capturedBody.contains("ana@example.com"))
        assertEquals("access-123", session.accessToken)
        assertEquals("refresh-456", session.refreshToken)
        assertEquals("user-1", session.user?.id)
    }

    @Test
    fun `fetchPurchases envia bearer e select e mapeia compras aninhadas`() = runTest {
        var capturedAuth = ""
        var capturedSelect = ""
        var capturedApiKey = ""

        val engine = MockEngine { request ->
            capturedAuth = request.headers[HttpHeaders.Authorization].orEmpty()
            capturedSelect = request.url.parameters["select"].orEmpty()
            capturedApiKey = request.headers["apikey"].orEmpty()
            respond(
                content = """
                    [{"id":10,"date":"2026-10-01","total_price":99.9,"manual":false,
                      "created_at":"2026-10-01T10:00:00Z","updated_at":"2026-10-01T10:00:00Z",
                      "supermarket":{"id":3,"name":"Mercado Central","cnpj":"123","manual":false},
                      "items":[{"id":77,"name":"Arroz 5kg","code":"789","category_id":2,
                                "quantity":1,"unit":"un","price":24.9}]}]
                """.trimIndent(),
                status = HttpStatusCode.OK,
                headers = jsonHeaders
            )
        }

        val api = SupabaseApi("https://proj.supabase.co", "anon-key", client(engine))
        val purchases = api.fetchPurchases("access-123")

        assertEquals("Bearer access-123", capturedAuth)
        assertEquals("anon-key", capturedApiKey)
        assertTrue(capturedSelect.contains("items(id,name,code,category_id,quantity,unit,price)"))
        assertTrue(capturedSelect.contains("supermarket:supermarkets"))
        assertEquals(1, purchases.size)
        assertEquals(10L, purchases.first().id)
        assertEquals("Mercado Central", purchases.first().supermarket?.name)
        assertEquals("Arroz 5kg", purchases.first().items.first().name)
        assertEquals(24.9, purchases.first().items.first().price, 0.0001)
    }

    @Test
    fun `fetchPurchases com token invalido lanca SupabaseAuthException`() = runTest {
        val engine = MockEngine {
            respond(
                content = """{"message":"JWT expired"}""",
                status = HttpStatusCode.Unauthorized,
                headers = jsonHeaders
            )
        }
        val api = SupabaseApi("https://proj.supabase.co", "anon-key", client(engine))

        val error = runCatching { api.fetchPurchases("expirado") }.exceptionOrNull()

        assertTrue(error is SupabaseAuthException)
        assertEquals(401, (error as SupabaseAuthException).statusCode)
        assertTrue(error.message!!.contains("JWT expired"))
    }

    @Test
    fun `signIn com credenciais invalidas lanca SupabaseAuthException com mensagem do servidor`() = runTest {
        val engine = MockEngine {
            respond(
                content = """{"error_description":"Invalid login credentials"}""",
                status = HttpStatusCode.BadRequest,
                headers = jsonHeaders
            )
        }
        val api = SupabaseApi("https://proj.supabase.co", "anon-key", client(engine))

        val error = runCatching { api.signIn("ana@example.com", "errada") }.exceptionOrNull()

        assertTrue(error is SupabaseAuthException)
        assertEquals("Invalid login credentials", error!!.message)
    }

    @Test
    fun `api com placeholder nao esta configurada`() {
        val api = SupabaseApi("https://placeholder.supabase.co", "anon-key", client(MockEngine { respond("") }))
        assertTrue(!api.isConfigured)
    }

    @Test
    fun `insertReturningId pede representacao e devolve id`() = runTest {
        var capturedPath = ""
        var capturedPrefer = ""
        val engine = MockEngine { request ->
            capturedPath = request.url.encodedPath
            capturedPrefer = request.headers["Prefer"].orEmpty()
            respond(content = """[{"id":42}]""", status = HttpStatusCode.Created, headers = jsonHeaders)
        }
        val api = SupabaseApi("https://proj.supabase.co", "anon-key", client(engine))

        val id = api.insertReturningId(
            "tok",
            "supermarkets",
            kotlinx.serialization.json.buildJsonObject { put("name", kotlinx.serialization.json.JsonPrimitive("Mercado")) }
        )

        assertEquals(42L, id)
        assertEquals("/rest/v1/supermarkets", capturedPath)
        assertTrue(capturedPrefer.contains("return=representation"))
    }

    @Test
    fun `insertItems envia as mesmas chaves em todos os itens`() = runTest {
        var capturedBody = ""
        val engine = MockEngine { request ->
            capturedBody = (request.body as? TextContent)?.text.orEmpty()
            respond(content = "", status = HttpStatusCode.Created)
        }
        val api = SupabaseApi("https://proj.supabase.co", "anon-key", client(engine))

        val items = kotlinx.serialization.json.JsonArray(
            listOf(
                kotlinx.serialization.json.buildJsonObject {
                    put("purchase_id", kotlinx.serialization.json.JsonPrimitive(1))
                    put("name", kotlinx.serialization.json.JsonPrimitive("Arroz"))
                    put("code", kotlinx.serialization.json.JsonNull)
                    put("category_id", kotlinx.serialization.json.JsonPrimitive(2))
                    put("quantity", kotlinx.serialization.json.JsonPrimitive(1.0))
                    put("unit", kotlinx.serialization.json.JsonPrimitive("un"))
                    put("price", kotlinx.serialization.json.JsonPrimitive(9.9))
                },
                kotlinx.serialization.json.buildJsonObject {
                    put("purchase_id", kotlinx.serialization.json.JsonPrimitive(1))
                    put("name", kotlinx.serialization.json.JsonPrimitive("Leite"))
                    put("code", kotlinx.serialization.json.JsonPrimitive("789"))
                    put("category_id", kotlinx.serialization.json.JsonNull)
                    put("quantity", kotlinx.serialization.json.JsonPrimitive(2.0))
                    put("unit", kotlinx.serialization.json.JsonPrimitive("un"))
                    put("price", kotlinx.serialization.json.JsonPrimitive(4.5))
                }
            )
        )

        api.insertItems("tok", items)

        val array = SupabaseApi.json.parseToJsonElement(capturedBody).jsonArray
        val keys0 = array[0].jsonObject.keys
        val keys1 = array[1].jsonObject.keys
        assertEquals(keys0, keys1)
        assertTrue(keys0.contains("code"))
        assertTrue(keys0.contains("category_id"))
    }
}
