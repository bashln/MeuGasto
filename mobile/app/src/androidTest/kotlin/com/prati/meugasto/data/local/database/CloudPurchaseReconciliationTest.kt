package com.prati.meugasto.data.local.database

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CloudPurchaseReconciliationTest {
    private lateinit var database: AppDatabase

    @Before
    fun createDatabase() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext<Context>(),
            AppDatabase::class.java
        ).allowMainThreadQueries().build()
    }

    @After
    fun closeDatabase() {
        database.close()
    }

    @Test
    fun uploadIdCollisionKeepsCachedPurchaseAndTransfersReceiptHash() = runBlockingTest {
        val marketId = insertMarket()
        val cachedId = insertPurchase(marketId, remoteId = 55L)
        database.purchaseDao().insertItems(
            listOf(ItemEntity(purchaseId = cachedId, name = "Cloud item", quantity = 1.0, unit = "UN", price = 8.0))
        )
        val accessHash = "receipt-hash"
        val pendingId = insertPurchase(marketId, accessKeyHash = accessHash, pendingUser = "user-1")
        database.purchaseDao().insertItems(
            listOf(ItemEntity(purchaseId = pendingId, name = "Local item", quantity = 1.0, unit = "UN", price = 8.0))
        )

        database.purchaseDao().reconcileUploadedPurchase(pendingId, 55L)

        assertEquals(cachedId, database.purchaseDao().findIdByRemoteId(55L))
        assertEquals(cachedId, database.purchaseDao().findIdByAccessKeyHash(accessHash))
        assertNull(database.purchaseDao().getById(pendingId))
        assertEquals("Cloud item", database.purchaseDao().getById(cachedId)?.items?.single()?.name)
    }

    @Test
    fun remoteSnapshotDeletionPreservesLocalAndPendingPurchases() = runBlockingTest {
        val marketId = insertMarket()
        val deletedRemoteId = insertPurchase(marketId, remoteId = 11L)
        val retainedRemoteId = insertPurchase(marketId, remoteId = 12L)
        val localOnlyId = insertPurchase(marketId)
        val pendingId = insertPurchase(marketId, pendingUser = "user-1")

        database.purchaseDao().deleteRemotePurchasesNotIn(listOf(12L))

        assertNull(database.purchaseDao().getById(deletedRemoteId))
        assertEquals(12L, database.purchaseDao().getById(retainedRemoteId)?.purchase?.remoteId)
        assertNull(database.purchaseDao().getById(localOnlyId)?.purchase?.remoteId)
        assertEquals("user-1", database.purchaseDao().getById(pendingId)?.purchase?.pendingCloudUserId)
    }

    private suspend fun insertMarket(): Long = database.supermarketDao().insert(
        SupermarketEntity(name = "Mercado", createdAt = "2026-11-03T00:00:00")
    )

    private suspend fun insertPurchase(
        marketId: Long,
        remoteId: Long? = null,
        accessKeyHash: String? = null,
        pendingUser: String? = null
    ): Long = database.purchaseDao().insertPurchase(
        PurchaseEntity(
            supermarketId = marketId,
            date = "2026-11-03",
            totalPrice = 8.0,
            createdAt = "2026-11-03T00:00:00",
            updatedAt = "2026-11-03T00:00:00",
            remoteId = remoteId,
            accessKeyHash = accessKeyHash,
            pendingCloudUserId = pendingUser
        )
    )

    private fun runBlockingTest(block: suspend () -> Unit) = kotlinx.coroutines.runBlocking { block() }
}
