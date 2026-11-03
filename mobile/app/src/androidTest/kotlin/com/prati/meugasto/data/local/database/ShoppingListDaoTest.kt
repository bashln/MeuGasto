package com.prati.meugasto.data.local.database

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShoppingListDaoTest {

    private lateinit var db: AppDatabase
    private lateinit var dao: ShoppingListDao

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            InstrumentationRegistry.getInstrumentation().targetContext,
            AppDatabase::class.java
        ).allowMainThreadQueries().build()
        dao = db.shoppingListDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun estimatedPriceIsPersistedAndReadWithQuantityGreaterThanOne() = runBlocking {
        val listId = dao.insertList(list("Mercado"))
        val itemId = dao.insertItem(item(listId, price = 12.50, quantity = 3.0))

        val saved = dao.getListById(listId)!!.items.single()
        assertEquals(itemId, saved.id)
        assertEquals(12.50, saved.estimatedPrice, 0.001)
        assertEquals(37.50, saved.estimatedPrice * saved.quantity, 0.001)
    }

    @Test
    fun updateEstimatedPriceReplacesValueWithoutChangingOtherFields() = runBlocking {
        val listId = dao.insertList(list("Mercado"))
        val itemId = dao.insertItem(item(listId, price = 12.50, quantity = 2.0))

        dao.updateEstimatedPrice(itemId, 0.0)
        assertEquals(0.0, dao.getListById(listId)!!.items.single().estimatedPrice, 0.0)

        dao.updateEstimatedPrice(itemId, 99.99)
        val updated = dao.getListById(listId)!!.items.single()
        assertEquals(99.99, updated.estimatedPrice, 0.001)
        assertEquals("Leite", updated.name)
        assertEquals(2.0, updated.quantity, 0.001)
        assertEquals("UN", updated.unit)
    }

    @Test
    fun listFlowObservesPriceUpdate() = runBlocking {
        val listId = dao.insertList(list("Mercado"))
        val itemId = dao.insertItem(item(listId, price = 10.0))

        dao.updateEstimatedPrice(itemId, 25.75)

        val fromFlow = dao.getAllLists().first().single().items.single()
        assertEquals(25.75, fromFlow.estimatedPrice, 0.001)
    }

    private fun list(name: String) = ShoppingListEntity(
        name = name,
        createdAt = "2026-10-22",
        updatedAt = "2026-10-22"
    )

    private fun item(
        listId: Long,
        price: Double,
        quantity: Double = 1.0
    ) = ShoppingListItemEntity(
        shoppingListId = listId,
        name = "Leite",
        quantity = quantity,
        unit = "UN",
        estimatedPrice = price,
        createdAt = "2026-10-22"
    )
}
