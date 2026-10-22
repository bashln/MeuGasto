package com.prati.meugasto.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PriceInputTest {

    @Test
    fun `aceita virgula e ponto como separador decimal`() {
        assertEquals(12.50, PriceInput.parseEstimatedPrice("12,50")!!, 0.001)
        assertEquals(12.50, PriceInput.parseEstimatedPrice("12.50")!!, 0.001)
        assertEquals(12.50, PriceInput.parseEstimatedPrice(" 12,50 ")!!, 0.001)
    }

    @Test
    fun `aceita zero para limpar preco estimado`() {
        assertEquals(0.0, PriceInput.parseEstimatedPrice("0")!!, 0.0)
    }

    @Test
    fun `rejeita preco negativo, NaN e infinito`() {
        assertNull(PriceInput.parseEstimatedPrice("-1"))
        assertNull(PriceInput.parseEstimatedPrice("NaN"))
        assertNull(PriceInput.parseEstimatedPrice("Infinity"))
        assertNull(PriceInput.parseEstimatedPrice("-Infinity"))
    }

    @Test
    fun `rejeita entrada vazia ou nao numerica`() {
        assertNull(PriceInput.parseEstimatedPrice(""))
        assertNull(PriceInput.parseEstimatedPrice("   "))
        assertNull(PriceInput.parseEstimatedPrice("abc"))
        assertNull(PriceInput.parseEstimatedPrice("1,2,3"))
    }

    @Test
    fun `quantidade exige valor positivo e finito`() {
        assertEquals(2.5, PriceInput.parseQuantity("2,5")!!, 0.001)
        assertNull(PriceInput.parseQuantity("0"))
        assertNull(PriceInput.parseQuantity("-1"))
        assertNull(PriceInput.parseQuantity("NaN"))
        assertNull(PriceInput.parseQuantity("Infinity"))
    }
}
