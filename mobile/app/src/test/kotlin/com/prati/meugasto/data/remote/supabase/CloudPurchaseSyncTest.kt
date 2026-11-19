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
            items = listOf(RemoteItem(id = 200L, name = "Leite", quantity = 2.0, unit = "un", price = 12.0, priceBasis = "line_total"))
        )
        val sync = CloudPurchaseSync(database, runInTransaction = { it() })

        val outcome = sync.sync(listOf(remote))

        assertEquals(CloudSyncOutcome.Complete(synced = 1), outcome)
        assertEquals(12.0, insertedItems.captured.single().price, 0.001)
        coVerify { purchaseDao.deleteRemotePurchasesNotIn(listOf(100L)) }
    }

    @Test
    fun `unit prices from marked rows become local line totals`() = runTest {
        val (database, purchaseDao, supermarketDao) = databaseFixture()
        coEvery { purchaseDao.findIdByRemoteId(100L) } returns 30L
        coEvery { supermarketDao.findIdByRemoteId(7L) } returns 7L
        val inserted = slot<List<ItemEntity>>()
        coEvery { purchaseDao.insertItems(capture(inserted)) } returns Unit
        val remote = RemotePurchase(id = 100L, date = "2026-10-05", totalPrice = 10.0,
            supermarket = RemoteSupermarket(id = 7L, name = "Mercado"),
            items = listOf(
                RemoteItem(id = 200L, name = "Leite", quantity = 3.0, price = 3.33, priceBasis = "unit", lineTotal = 10.0),
                RemoteItem(id = 201L, name = "Queijo", quantity = 0.344, price = 44.91, priceBasis = "unit", lineTotal = 15.45)))

        val outcome = CloudPurchaseSync(database, runInTransaction = { it() }).sync(listOf(remote))

        assertEquals(CloudSyncOutcome.Complete(synced = 1), outcome)
        assertEquals(listOf(10.0, 15.45), inserted.captured.map { it.price })
    }

    @Test
    fun `unknown historical prices preserve local items and report unpriced items`() = runTest {
        val (database, purchaseDao, supermarketDao) = databaseFixture()
        coEvery { purchaseDao.findIdByRemoteId(100L) } returns 30L
        coEvery { supermarketDao.findIdByRemoteId(7L) } returns 7L
        val remote = RemotePurchase(id = 100L, date = "2026-10-05", totalPrice = 10.0,
            supermarket = RemoteSupermarket(id = 7L, name = "Mercado"),
            items = listOf(RemoteItem(id = 200L, name = "Leite", quantity = 2.0, price = 5.0)))
        val outcome = CloudPurchaseSync(database, runInTransaction = { it() }).sync(listOf(remote))

        assertEquals(CloudSyncOutcome.UnpricedItems(synced = 1, unpricedItemCount = 1), outcome)
        coVerify { purchaseDao.updateFromRemote(30L, 7L, "2026-10-05", 10.0, false, any()) }
        coVerify(exactly = 0) { purchaseDao.deleteItemsByPurchaseId(any()) }
        coVerify(exactly = 0) { purchaseDao.insertItems(any()) }
    }

    @Test
    fun `unpriced items are counted across the whole snapshot`() = runTest {
        val (database, purchaseDao, supermarketDao) = databaseFixture()
        coEvery { purchaseDao.findIdByRemoteId(any()) } returns 30L
        coEvery { supermarketDao.findIdByRemoteId(7L) } returns 7L
        val priced = RemotePurchase(id = 100L, date = "2026-10-05", totalPrice = 10.0,
            supermarket = RemoteSupermarket(id = 7L, name = "Mercado"),
            items = listOf(RemoteItem(id = 200L, name = "Leite", quantity = 2.0, price = 10.0, priceBasis = "unit")))
        val unpriced = RemotePurchase(id = 101L, date = "2026-10-06", totalPrice = 12.0,
            supermarket = RemoteSupermarket(id = 7L, name = "Mercado"),
            items = listOf(
                RemoteItem(id = 201L, name = "Queijo", quantity = 1.0, price = 8.0),
                RemoteItem(id = 202L, name = "Pão", quantity = 2.0, price = 2.0)))

        val outcome = CloudPurchaseSync(database, runInTransaction = { it() }).sync(listOf(priced, unpriced))

        assertEquals(CloudSyncOutcome.UnpricedItems(synced = 2, unpricedItemCount = 2), outcome)
    }

    @Test
    fun `empty remote snapshot clears synced rows without touching local pending rows`() = runTest {
        val (database, purchaseDao) = databaseFixture()
        val sync = CloudPurchaseSync(database, runInTransaction = { it() })

        assertEquals(CloudSyncOutcome.Complete(synced = 0), sync.sync(emptyList()))

        coVerify(exactly = 1) { purchaseDao.deleteAllRemotePurchases() }
        coVerify(exactly = 0) { purchaseDao.deleteRemotePurchasesNotIn(any()) }
    }
}
