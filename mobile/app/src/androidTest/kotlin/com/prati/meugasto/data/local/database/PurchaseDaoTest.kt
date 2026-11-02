package com.prati.meugasto.data.local.database

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PurchaseDaoTest {

    private lateinit var db: AppDatabase
    private lateinit var dao: PurchaseDao
    private var marketId: Long = 0

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            AppDatabase::class.java
        ).allowMainThreadQueries().build()
        dao = db.purchaseDao()
        marketId = runBlocking {
            db.supermarketDao().insert(
                SupermarketEntity(
                    name = "Mercado Central",
                    createdAt = "2026-11-02"
                )
            )
        }
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun savingTheSameAccessKeyTwiceReturnsTheFirstPurchaseWithoutTouchingItsItems() = runBlocking {
        val first = dao.savePurchaseWithItems(purchase(hash = "hash-1"), items())
        val second = dao.savePurchaseWithItems(purchase(hash = "hash-1"), items())

        assertFalse(first.alreadyExisted)
        assertTrue(second.alreadyExisted)
        assertEquals(first.id, second.id)

        val saved = dao.getById(first.id)!!
        assertEquals(1, saved.items.size)
        assertEquals(1, db.purchaseDao().getAllWithDetails().first().size)
    }

    @Test
    fun purchasesWithoutAccessKeyAreAlwaysInserted() = runBlocking {
        val first = dao.savePurchaseWithItems(purchase(hash = null), items())
        val second = dao.savePurchaseWithItems(purchase(hash = null), items())

        assertFalse(first.alreadyExisted)
        assertFalse(second.alreadyExisted)
        assertTrue(first.id != second.id)
        assertEquals(2, dao.getAllWithDetails().first().size)
    }

    private fun purchase(hash: String?) = PurchaseEntity(
        supermarketId = marketId,
        date = "2026-11-02",
        totalPrice = 10.0,
        createdAt = "2026-11-02T10:00:00",
        updatedAt = "2026-11-02T10:00:00",
        accessKey = "33260993015006000113651040003070441999999999",
        accessKeyHash = hash
    )

    private fun items() = listOf(
        ItemEntity(
            purchaseId = 0,
            name = "Arroz",
            quantity = 1.0,
            unit = "UN",
            price = 10.0,
            canonicalName = "name:arroz"
        )
    )
}
