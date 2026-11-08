package com.prati.meugasto.data.remote.supabase

import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseDao
import com.prati.meugasto.data.local.database.SupermarketDao
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class CloudPurchaseSyncTest {
    private fun databaseFixture(): Triple<AppDatabase, PurchaseDao, SupermarketDao> {
        val purchaseDao = mockk<PurchaseDao>(relaxed = true)
        val supermarketDao = mockk<SupermarketDao>(relaxed = true)
        val database = mockk<AppDatabase>(relaxed = true)
        every { database.purchaseDao() } returns purchaseDao
        every { database.supermarketDao() } returns supermarketDao
        return Triple(database, purchaseDao, supermarketDao)
    }

    @Test
    fun `sync preserves legacy cloud line total and prunes missing remote ids`() = runTest {
        val (database, purchaseDao, supermarketDao) = databaseFixture()
        coEvery { purchaseDao.findIdByRemoteId(100L) } returns null
        coEvery { purchaseDao.insertPurchase(any()) } returns 30L
        coEvery { supermarketDao.findIdByRemoteId(7L) } returns 7L
        val insertedItems = slot<List<ItemEntity>>()
        coEvery { purchaseDao.insertItems(capture(insertedItems)) } returns Unit
        val remote = RemotePurchase(
            id = 100L,
            date = "2026-10-05",
            totalPrice = 10.0,
            supermarket = RemoteSupermarket(id = 7L, name = "Mercado Teste"),
            items = listOf(RemoteItem(id = 200L, name = "Leite", quantity = 2.0, unit = "un", price = 12.0))
        )
        val sync = CloudPurchaseSync(database, runInTransaction = { it() })

        val synced = sync.sync(listOf(remote))

        assertEquals(1, synced)
        assertEquals(12.0, insertedItems.captured.single().price, 0.001)
        coVerify { purchaseDao.deleteRemotePurchasesNotIn(listOf(100L)) }
    }

    @Test
    fun `empty remote snapshot clears synced rows without touching local pending rows`() = runTest {
        val (database, purchaseDao) = databaseFixture()
        val sync = CloudPurchaseSync(database, runInTransaction = { it() })

        assertEquals(0, sync.sync(emptyList()))

        coVerify(exactly = 1) { purchaseDao.deleteAllRemotePurchases() }
        coVerify(exactly = 0) { purchaseDao.deleteRemotePurchasesNotIn(any()) }
    }
}
