package com.prati.meugasto.data.remote.supabase

import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseDao
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.PurchaseWithSupermarketAndItems
import com.prati.meugasto.data.local.database.SupermarketDao
import com.prati.meugasto.data.local.database.SupermarketEntity
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CloudPurchaseUploaderTest {

    private val jsonHeaders = headersOf(HttpHeaders.ContentType, "application/json")

    private fun detail(remoteMarketId: Long?): PurchaseWithSupermarketAndItems {
        val market = SupermarketEntity(
            id = 7,
            name = "Mercado Teste",
            cnpj = "123",
            city = "POA",
            state = "RS",
            isManual = false,
            createdAt = "2026-10-01T10:00:00",
            remoteId = remoteMarketId
        )
        val purchase = PurchaseEntity(
            id = 1,
            supermarketId = 7,
            date = "2026-10-05",
            totalPrice = 19.8,
            isManual = false,
            createdAt = "2026-10-05T10:00:00",
            updatedAt = "2026-10-05T10:00:00"
        )
        val items = listOf(
            ItemEntity(id = 1, purchaseId = 1, name = "Arroz", code = null, categoryId = 2, quantity = 1.0, unit = "un", price = 9.9),
            ItemEntity(id = 2, purchaseId = 1, name = "Leite", code = "789", categoryId = null, quantity = 2.0, unit = "un", price = 4.95)
        )
        return PurchaseWithSupermarketAndItems(purchase, market, items)
    }

    private data class FakeDb(
        val database: AppDatabase,
        val purchaseDao: PurchaseDao,
        val supermarketDao: SupermarketDao
    )

    private fun buildDatabase(detail: PurchaseWithSupermarketAndItems): FakeDb {
        val purchaseDao = mockk<PurchaseDao>(relaxed = true)
        val supermarketDao = mockk<SupermarketDao>(relaxed = true)
        coEvery { purchaseDao.getById(1L) } returns detail
        val database = mockk<AppDatabase>(relaxed = true)
        every { database.purchaseDao() } returns purchaseDao
        every { database.supermarketDao() } returns supermarketDao
        return FakeDb(database, purchaseDao, supermarketDao)
    }

    private fun authLoggedIn(): SupabaseAuthRepository {
        val auth = mockk<SupabaseAuthRepository>(relaxed = true)
        every { auth.state } returns MutableStateFlow(AuthState.LoggedIn("user-1", "a@b.com", "A"))
        every { auth.currentAccessToken() } returns "tok"
        return auth
    }

    private fun mockApi(): SupabaseApi {
        val engine = MockEngine { request ->
            when {
                request.url.encodedPath.endsWith("/supermarkets") ->
                    respond("""[{"id":10}]""", HttpStatusCode.Created, jsonHeaders)
                request.url.encodedPath.endsWith("/purchases") ->
                    respond("""[{"id":20}]""", HttpStatusCode.Created, jsonHeaders)
                else -> respond("", HttpStatusCode.Created)
            }
        }
        val client = HttpClient(engine) { install(ContentNegotiation) { json(SupabaseApi.json) } }
        return SupabaseApi("https://proj.supabase.co", "anon-key", client)
    }

    @Test
    fun `upload cria supermercado, compra e itens e guarda remoteId`() = runTest {
        val db = buildDatabase(detail(remoteMarketId = null))
        val uploader = CloudPurchaseUploader(mockApi(), authLoggedIn(), db.database)

        val result = uploader.upload(1L)

        assertEquals(20L, result.getOrNull())
        coVerify { db.purchaseDao.setRemoteId(1L, 20L) }
        coVerify { db.supermarketDao.setRemoteId(7L, 10L) }
    }

    @Test
    fun `upload reutiliza supermercado ja remoto`() = runTest {
        val db = buildDatabase(detail(remoteMarketId = 55L))
        val uploader = CloudPurchaseUploader(mockApi(), authLoggedIn(), db.database)

        val result = uploader.upload(1L)

        assertEquals(20L, result.getOrNull())
        coVerify(exactly = 0) { db.supermarketDao.setRemoteId(any(), any()) }
    }

    @Test
    fun `upload sem sessao falha`() = runTest {
        val db = buildDatabase(detail(remoteMarketId = null))
        val auth = mockk<SupabaseAuthRepository>(relaxed = true)
        every { auth.state } returns MutableStateFlow(AuthState.LoggedOut)
        val uploader = CloudPurchaseUploader(mockApi(), auth, db.database)

        val result = uploader.upload(1L)

        assertTrue(result.isFailure)
    }
}
