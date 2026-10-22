package com.prati.meugasto.data.local.database

import com.prati.meugasto.domain.comparator.ProductCanonicalizer
import org.junit.Assert.assertEquals
import org.junit.Test

class ItemCanonicalNameBackfillTest {

    @Test
    fun `codigo com espacos nas extremidades usa a mesma chave do runtime`() {
        val canonical = ItemCanonicalNameBackfill.canonicalNames(
            listOf(ItemCanonicalNameBackfill.Row(id = 1, name = "Arroz 5kg", code = "  789123  "))
        )

        assertEquals("code:789123", canonical[1])
        assertEquals(ProductCanonicalizer.canonicalKey("Arroz 5kg", "  789123  "), canonical[1])
    }

    @Test
    fun `codigo vazio ou apenas espacos cai para o nome normalizado`() {
        val canonical = ItemCanonicalNameBackfill.canonicalNames(
            listOf(
                ItemCanonicalNameBackfill.Row(id = 1, name = "  ARROZ 5KG ", code = ""),
                ItemCanonicalNameBackfill.Row(id = 2, name = "Leite Integral", code = "   ")
            )
        )

        assertEquals("name:arroz 5kg", canonical[1])
        assertEquals("name:leite integral", canonical[2])
    }

    @Test
    fun `codigo nulo cai para o nome normalizado com acentos removidos`() {
        val canonical = ItemCanonicalNameBackfill.canonicalNames(
            listOf(ItemCanonicalNameBackfill.Row(id = 7, name = "SABÃO EM PÓ", code = null))
        )

        assertEquals("name:sabao em po", canonical[7])
    }

    @Test
    fun `migracao e novas compras produzem a mesma chave`() {
        val rows = listOf(
            ItemCanonicalNameBackfill.Row(id = 1, name = "Café Torrado", code = " 123 "),
            ItemCanonicalNameBackfill.Row(id = 2, name = "Café Torrado", code = null)
        )

        val migrated = ItemCanonicalNameBackfill.canonicalNames(rows)

        assertEquals(ProductCanonicalizer.canonicalKey("Café Torrado", " 123 "), migrated[1])
        assertEquals(ProductCanonicalizer.canonicalKey("Café Torrado", null), migrated[2])
    }
}
