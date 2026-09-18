package com.prati.meugasto.domain.comparator

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    @Test
    fun testExactAndAbbreviatedSimilarity() {
        val sim = StringMatcher.calculateSimilarity("Leite", "LEITE INTEGRAL 1L")
        assertEquals(1.0, sim, 0.01)

        val simRefri = StringMatcher.calculateSimilarity("Refrigerante Coca Cola", "REFRI COCA COLA 2L")
        assertEquals(1.0, simRefri, 0.01)
    }

    @Test
    fun testExclusionModifiersPenalization() {
        // Leite vs Leite Condensado deve pontuar baixo para não confundir itens
        val sim = StringMatcher.calculateSimilarity("Leite", "LEITE CONDENSADO MOCA")
        assertEquals(0.1, sim, 0.01)

        // Pão vs Pão de Queijo
        val simPao = StringMatcher.calculateSimilarity("Pao", "PAO DE QUEIJO CONGELADO")
        assertEquals(0.1, simPao, 0.01)
    }

    @Test
    fun testLevenshteinDistance() {
        assertEquals(0, StringMatcher.levenshteinDistance("teste", "teste"))
        assertEquals(1, StringMatcher.levenshteinDistance("teste", "leste"))
        assertEquals(3, StringMatcher.levenshteinDistance("kitten", "sitting"))
    }
}

