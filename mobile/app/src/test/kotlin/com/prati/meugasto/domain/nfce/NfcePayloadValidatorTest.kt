package com.prati.meugasto.domain.nfce

import org.junit.Assert.assertEquals
import org.junit.Test

class NfcePayloadValidatorTest {

    @Test
    fun testSanitizeTextPreservesSlashAndPercentage() {
        val input = "CERVEJA 350ML 4,5% ALC / SABÃO C/ AMACIANTE"
        val sanitized = NfcePayloadValidator.sanitizeText(input, 100)
        assertEquals("CERVEJA 350ML 4,5% ALC / SABÃO C/ AMACIANTE", sanitized)
    }

    @Test
    fun testValidateScrapedDataAcceptsLargeReceipts() {
        val items = (1..250).map { i ->
            NfceScrapedItem(
                name = "PRODUTO $i",
                quantity = 1.0,
                unit = "UN",
                price = 2.0
            )
        }
        val scrapedData = NfceScrapedData(
            accessKey = "43260993015006000113651040003070441999999999",
            supermarket = NfceSupermarketInfo(
                name = "Supermercado Grande",
                cnpj = "93.015.006/0001-13",
                state = "RS"
            ),
            items = items,
            totalPrice = 500.0,
            date = "2026-09-18"
        )

        val result = NfcePayloadValidator.validateScrapedData(scrapedData)
        assertEquals(250, result.items.size)
        assertEquals(500.0, result.totalPrice, 0.01)
    }
}
