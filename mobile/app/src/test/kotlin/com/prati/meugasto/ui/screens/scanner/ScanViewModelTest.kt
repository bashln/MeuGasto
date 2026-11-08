package com.prati.meugasto.ui.screens.scanner

import com.prati.meugasto.data.local.database.ProductPriceEntry
import com.prati.meugasto.data.local.database.ProductStats
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.data.repository.SavePurchaseResult
import com.prati.meugasto.domain.model.DashboardStats
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.domain.nfce.NfceScrapedData
import com.prati.meugasto.domain.nfce.NfceScrapedItem
import com.prati.meugasto.domain.nfce.NfceScraper
import com.prati.meugasto.domain.nfce.NfceSupermarketInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ScanViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `leitura bem sucedida abre a confirmacao`() = runTest(dispatcher) {
        val viewModel = ScanViewModel(FakePurchaseRepository(), successfulScraper())

        viewModel.onQrDetected(RJ_URL)
        advanceUntilIdle()

        val step = viewModel.state.value.step
        assertTrue(step is ScanState.Confirmation)
        assertEquals("Mercado RJ", (step as ScanState.Confirmation).data.supermarket.name)
    }

    @Test
    fun `salvar emite compra nova e volta a escanear`() = runTest(dispatcher) {
        val repository = FakePurchaseRepository(SavePurchaseResult(7L, alreadyExisted = false))
        val viewModel = ScanViewModel(repository, successfulScraper())
        viewModel.onQrDetected(RJ_URL)
        advanceUntilIdle()

        val event = async { viewModel.savedPurchases.first() }
        advanceUntilIdle()
        viewModel.confirmPurchase()
        advanceUntilIdle()

        assertEquals(7L, event.await().id)
        assertTrue(viewModel.state.value.step is ScanState.Scanning)
        assertEquals(1, repository.saved.size)
    }

    @Test
    fun `salvar nota ja registrada emite duplicata`() = runTest(dispatcher) {
        val repository = FakePurchaseRepository(SavePurchaseResult(7L, alreadyExisted = true))
        val viewModel = ScanViewModel(repository, successfulScraper())
        viewModel.onQrDetected(RJ_URL)
        advanceUntilIdle()

        viewModel.confirmPurchase()
        advanceUntilIdle()

        val step = viewModel.state.value.step
        assertTrue(step is ScanState.Duplicate)
        assertEquals(7L, (step as ScanState.Duplicate).purchaseId)
    }

    @Test
    fun `falha ao salvar volta para a confirmacao no retry`() = runTest(dispatcher) {
        val repository = FakePurchaseRepository(
            result = SavePurchaseResult(0L, alreadyExisted = false),
            failSaves = true
        )
        val viewModel = ScanViewModel(repository, successfulScraper())
        viewModel.onQrDetected(RJ_URL)
        advanceUntilIdle()

        viewModel.confirmPurchase()
        advanceUntilIdle()
        assertEquals(ScanFailure.SaveFailed, (viewModel.state.value.step as ScanState.Error).failure)

        viewModel.retry()

        assertTrue(viewModel.state.value.step is ScanState.Confirmation)
    }

    @Test
    fun `frames repetidos e toque duplo salvam uma unica compra com os dados fiscais intactos`() = runTest(dispatcher) {
        val repository = FakePurchaseRepository()
        val viewModel = ScanViewModel(repository, successfulScraper())

        repeat(3) { viewModel.onQrDetected(RJ_URL) }
        advanceUntilIdle()
        viewModel.confirmPurchase()
        viewModel.confirmPurchase()
        advanceUntilIdle()

        val purchase = repository.saved.single()
        assertEquals("33260993015006000113651040003070441999999999", purchase.accessKey)
        assertEquals("Mercado RJ", purchase.supermarket.name)
        assertEquals("RJ", purchase.supermarket.state)
        assertEquals("2024-07-03", purchase.date)
        assertEquals(10.0, purchase.totalPrice, 0.001)
        val item = purchase.products.single()
        assertEquals("Produto", item.name)
        assertEquals(1.0, item.quantity, 0.001)
        assertEquals("UN", item.unit)
        assertEquals(10.0, item.price, 0.001)
        assertTrue(viewModel.state.value.step is ScanState.Scanning)
    }

    @Test
    fun `duplicate verification warning can retry without rescanning receipt`() = runTest(dispatcher) {
        val repository = FakePurchaseRepository(SavePurchaseResult(7L, alreadyExisted = true, warning = "Sem conexão"))
        val viewModel = ScanViewModel(repository, successfulScraper())
        viewModel.onQrDetected(RJ_URL)
        advanceUntilIdle()
        viewModel.confirmPurchase()
        advanceUntilIdle()
        assertEquals("Sem conexão", (viewModel.state.value.step as ScanState.Duplicate).warning)

        repository.result = SavePurchaseResult(7L, alreadyExisted = true)
        viewModel.retryPriceVerification()
        advanceUntilIdle()

        assertEquals(ScanState.Duplicate(7L), viewModel.state.value.step)
        assertEquals(2, repository.saved.size)
        assertEquals("Produto", repository.saved[1].products.single().name)
        assertEquals(10.0, repository.saved[1].products.single().price, 0.001)
    }

    private fun successfulScraper(): NfceScraper = object : NfceScraper {
        override suspend fun scrapeUrl(url: String): Result<NfceScrapedData> = Result.success(
            NfceScrapedData(
                accessKey = "33260993015006000113651040003070441999999999",
                supermarket = NfceSupermarketInfo(name = "Mercado RJ", state = "RJ"),
                items = listOf(
                    NfceScrapedItem(name = "Produto", quantity = 1.0, unit = "UN", price = 10.0)
                ),
                totalPrice = 10.0,
                date = "2024-07-03"
            )
        )
    }

    private class FakePurchaseRepository(
        var result: SavePurchaseResult = SavePurchaseResult(1L, alreadyExisted = false),
        private val failSaves: Boolean = false
    ) : PurchaseRepository {
        val saved = mutableListOf<Purchase>()

        override fun getPurchases(): Flow<List<Purchase>> = emptyFlow()
        override suspend fun savePurchase(purchase: Purchase): SavePurchaseResult {
            if (failSaves) throw IllegalStateException("disco cheio")
            saved += purchase
            return result
        }

        override suspend fun deletePurchase(purchaseId: Long) = Unit
        override fun getDashboardStats(): Flow<DashboardStats> = emptyFlow()
        override fun getSpendingByMarket(): Flow<List<Pair<String, Double>>> = emptyFlow()
        override fun getSpendingByDate(): Flow<List<Pair<String, Double>>> = emptyFlow()
        override fun getTopProducts(limit: Int): Flow<List<ProductStats>> = emptyFlow()
        override fun getProductPriceHistory(productName: String): Flow<List<ProductPriceEntry>> = emptyFlow()
        override fun getAllProductNames(): Flow<List<String>> = emptyFlow()
    }

    private companion object {
        const val RJ_URL =
            "https://consultadfe.fazenda.rj.gov.br/consulta?p=33260993015006000113651040003070441999999999"
    }
}
