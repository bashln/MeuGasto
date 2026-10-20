package com.prati.meugasto.domain.comparator

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PriceComparatorTest {

    @Test
    fun `compares weight items correctly with different units grams and kilograms`() {
        // Exemplo da solicitação: item 1: R$ 10 por 500g, item 2: R$ 20 por 1,2kg
        // Item 1: R$ 10 / 0.5kg = R$ 20.00 / kg
        // Item 2: R$ 20 / 1.2kg = R$ 16.666... / kg
        // Item 2 é mais barato por kg
        val item1 = ComparisonCandidate(name = "Produto A", price = 10.0, quantity = 500.0, unit = "g")
        val item2 = ComparisonCandidate(name = "Produto B", price = 20.0, quantity = 1.2, unit = "kg")

        val result = PriceComparator.compare(item1, item2)

        assertTrue(result.isComparable)
        assertEquals("kg", result.standardUnit)
        assertEquals(20.0, result.unitPrice1!!, 0.001)
        assertEquals(16.6666, result.unitPrice2!!, 0.001)
        assertEquals(2, result.cheaperIndex)
        assertEquals(16.6666, result.savingsPercentage!!, 0.01)
        assertTrue(result.message.contains("Produto B"))
    }

    @Test
    fun `identifies cheaper volume item between liters and milliliters`() {
        // Item 1: 1L por R$ 8.00 -> R$ 8.00 / L
        // Item 2: 500ml por R$ 3.50 -> R$ 7.00 / L
        val item1 = ComparisonCandidate(name = "Leite 1L", price = 8.0, quantity = 1.0, unit = "L")
        val item2 = ComparisonCandidate(name = "Leite 500ml", price = 3.5, quantity = 500.0, unit = "ml")

        val result = PriceComparator.compare(item1, item2)

        assertTrue(result.isComparable)
        assertEquals("L", result.standardUnit)
        assertEquals(8.0, result.unitPrice1!!, 0.001)
        assertEquals(7.0, result.unitPrice2!!, 0.001)
        assertEquals(2, result.cheaperIndex)
        assertEquals(12.5, result.savingsPercentage!!, 0.01)
    }

    @Test
    fun `identifies cheaper count item between units and dozen`() {
        // Item 1: 12 ovos por R$ 12.00 -> R$ 1.00 / un
        // Item 2: 1 duzia por R$ 10.80 -> R$ 0.90 / un
        val item1 = ComparisonCandidate(name = "Ovos avulsos", price = 12.0, quantity = 12.0, unit = "un")
        val item2 = ComparisonCandidate(name = "Ovos cartela", price = 10.8, quantity = 1.0, unit = "dz")

        val result = PriceComparator.compare(item1, item2)

        assertTrue(result.isComparable)
        assertEquals("un", result.standardUnit)
        assertEquals(1.0, result.unitPrice1!!, 0.001)
        assertEquals(0.9, result.unitPrice2!!, 0.001)
        assertEquals(2, result.cheaperIndex)
    }

    @Test
    fun `rejects comparison between incompatible categories like weight and volume`() {
        val carne = ComparisonCandidate(name = "Carne", price = 35.0, quantity = 1.0, unit = "kg")
        val suco = ComparisonCandidate(name = "Suco", price = 10.0, quantity = 1.0, unit = "L")

        val result = PriceComparator.compare(carne, suco)

        assertFalse(result.isComparable)
        assertNull(result.cheaperIndex)
        assertTrue(result.message.contains("grandezas diferentes"))
    }

    @Test
    fun `returns equal when both items have identical price per base unit`() {
        val item1 = ComparisonCandidate(name = "Açúcar 1kg", price = 5.0, quantity = 1.0, unit = "kg")
        val item2 = ComparisonCandidate(name = "Açúcar 500g", price = 2.5, quantity = 500.0, unit = "g")

        val result = PriceComparator.compare(item1, item2)

        assertTrue(result.isComparable)
        assertNull(result.cheaperIndex)
        assertEquals(0.0, result.savingsPercentage!!, 0.001)
        assertTrue(result.message.contains("mesmo custo"))
    }

    @Test
    fun `handles invalid or zero quantity gracefully`() {
        val item1 = ComparisonCandidate(name = "Invalido", price = 10.0, quantity = 0.0, unit = "kg")
        val item2 = ComparisonCandidate(name = "Valido", price = 10.0, quantity = 1.0, unit = "kg")

        val result = PriceComparator.compare(item1, item2)

        assertFalse(result.isComparable)
    }
}
