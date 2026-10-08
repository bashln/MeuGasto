package com.prati.meugasto.domain.analytics

import org.junit.Assert.assertEquals
import org.junit.Test

class ProductPriceAnalyticsTest {

    data class RawItem(
        val name: String,
        val quantity: Double,
        val totalPricePaid: Double
    ) {
        val unitPrice: Double
            get() = if (quantity > 0.0) totalPricePaid / quantity else totalPricePaid
    }

    @Test
    fun totalSpentInProductIsSumOfItemPriceNotMultipliedByQuantityAgain() {
        val purchases = listOf(
            RawItem(name = "Cerveja Heineken 330ml", quantity = 6.0, totalPricePaid = 36.00),
            RawItem(name = "Cerveja Heineken 330ml", quantity = 1.0, totalPricePaid = 6.00)
        )

        val totalSpent = purchases.sumOf { it.totalPricePaid }
        val totalQty = purchases.sumOf { it.quantity }

        assertEquals(42.00, totalSpent, 0.001)
        assertEquals(7.0, totalQty, 0.001)
    }

    @Test
    fun priceComparisonUsesUnitPriceAcrossDifferentQuantities() {
        val purchasePack = RawItem(name = "Refrigerante 2L", quantity = 3.0, totalPricePaid = 24.00)
        val purchaseSingle = RawItem(name = "Refrigerante 2L", quantity = 1.0, totalPricePaid = 8.50)

        // Pack unit price was 8.00, single unit was 8.50
        assertEquals(8.00, purchasePack.unitPrice, 0.001)
        assertEquals(8.50, purchaseSingle.unitPrice, 0.001)
    }
}
