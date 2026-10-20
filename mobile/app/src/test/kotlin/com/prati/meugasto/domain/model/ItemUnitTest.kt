package com.prati.meugasto.domain.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ItemUnitTest {

    @Test
    fun unitPriceCalculatesCorrectlyForUnitaryQuantity() {
        val item = Item(
            name = "Sabonete",
            quantity = 1.0,
            unit = "UN",
            price = 3.50
        )
        assertEquals(3.50, item.unitPrice, 0.001)
    }

    @Test
    fun unitPriceCalculatesCorrectlyForMultipleUnits() {
        val item = Item(
            name = "Leite UHT 1L",
            quantity = 6.0,
            unit = "UN",
            price = 30.00
        )
        assertEquals(5.00, item.unitPrice, 0.001)
    }

    @Test
    fun unitPriceCalculatesCorrectlyForWeightedItems() {
        val item = Item(
            name = "Manga Palmer",
            quantity = 0.500,
            unit = "KG",
            price = 4.00
        )
        // 4.00 / 0.5 = 8.00/kg
        assertEquals(8.00, item.unitPrice, 0.001)
    }

    @Test
    fun unitPriceHandlesZeroQuantitySafely() {
        val item = Item(
            name = "Item Brinde",
            quantity = 0.0,
            unit = "UN",
            price = 0.00
        )
        assertEquals(0.00, item.unitPrice, 0.001)
    }
}
