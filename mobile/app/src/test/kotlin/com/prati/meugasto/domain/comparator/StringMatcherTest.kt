package com.prati.meugasto.domain.comparator

import org.junit.Assert.assertEquals
import org.junit.Test

class StringMatcherTest {

    @Test
    fun testNormalizeExpandsAbbreviations() {
        val result = StringMatcher.normalize("REFRI COCA COLA PET 2L")
        assertEquals("refrigerante coca cola pet 2l", result)

        val result2 = StringMatcher.normalize("DET IPE MACA 500ML")
        assertEquals("detergente ipe maca 500ml", result2)

        val result3 = StringMatcher.normalize("LEITE COND MOCA")
        assertEquals("leite condensado moca", result3)
    }
}
