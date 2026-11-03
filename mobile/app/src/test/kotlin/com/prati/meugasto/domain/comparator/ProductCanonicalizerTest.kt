package com.prati.meugasto.domain.comparator

import org.junit.Assert.assertEquals
import org.junit.Test

class ProductCanonicalizerTest {
    @Test
    fun `canonical key prefers code`() {
        assertEquals("code:123", ProductCanonicalizer.canonicalKey("Arroz 5kg", "123"))
    }

    @Test
    fun `canonical key normalizes name when no code`() {
        assertEquals("name:arroz 5kg", ProductCanonicalizer.canonicalKey("  ARROZ 5KG "))
    }
}
