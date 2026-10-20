package com.prati.meugasto.data.repository

import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.PurchaseDao
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.SupermarketDao
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.domain.model.Supermarket
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class LocalPurchaseRepositoryTest {
    private data class Fixture(
        val repository: LocalPurchaseRepository,
        val savedPurchase: io.mockk.CapturingSlot<PurchaseEntity>
    )

    private fun fixture(mode: AppMode): Fixture {
        val database = mockk<AppDatabase>()
        val purchases = mockk<PurchaseDao>()
        val supermarkets = mockk<SupermarketDao>()
        val savedPurchase = slot<PurchaseEntity>()
        every { database.purchaseDao() } returns purchases
        every { database.supermarketDao() } returns supermarkets
        coEvery { supermarkets.findByName(any()) } returns null
        coEvery { supermarkets.insert(any()) } returns 5L
        coEvery { purchases.insertPurchaseWithItems(capture(savedPurchase), any()) } returns 10L

        return Fixture(
            repository = LocalPurchaseRepository(
                database = database,
                remotePurchaseDeleter = RemotePurchaseDeleter { _ -> },
                currentAppMode = { mode },
                currentCloudUserId = { "account-1" }
            ),
            savedPurchase = savedPurchase
        )
    }

    private fun purchase() = Purchase(
        supermarket = Supermarket(name = "Mercado Central"),
        date = "2026-10-20",
        totalPrice = 12.0,
        accessKey = "43260993015006000113651040003070441999999999"
    )

    @Test
    fun `compra salva em modo nuvem fica na fila da conta atual`() = runTest {
        val fixture = fixture(AppMode.CLOUD)

        fixture.repository.savePurchase(purchase())

        assertEquals("account-1", fixture.savedPurchase.captured.pendingCloudUserId)
    }

    @Test
    fun `compra salva em modo local nao entra na fila da nuvem`() = runTest {
        val fixture = fixture(AppMode.LOCAL_FIRST)

        fixture.repository.savePurchase(purchase())

        assertEquals(null, fixture.savedPurchase.captured.pendingCloudUserId)
    }
}
