package com.prati.meugasto.domain.nfce

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class NfcePayloadValidatorTest {

    private fun dataWith(
        items: List<NfceScrapedItem>,
        totalPrice: Double
    ) = NfceScrapedData(
        accessKey = "43260993015006000113651040003070441999999999",
        supermarket = NfceSupermarketInfo(
            name = "Supermercado Teste",
            cnpj = "93.015.006/0001-13",
            state = "RS"
        ),
        items = items,
        totalPrice = totalPrice,
        date = "2026-09-18"
    )

    private fun item(name: String = "PRODUTO", price: Double = 10.0) = NfceScrapedItem(
        name = name,
        quantity = 1.0,
        unit = "UN",
        price = price
    )

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

    @Test
    fun `rejeita preco negativo`() {
        assertThrows(IllegalArgumentException::class.java) {
            NfcePayloadValidator.validateScrapedData(
                dataWith(listOf(item(price = -0.01)), totalPrice = 1.0)
            )
        }
    }

    @Test
    fun `rejeita preco e quantidade nao finitos`() {
        assertThrows(IllegalArgumentException::class.java) {
            NfcePayloadValidator.validateScrapedData(
                dataWith(listOf(item(price = Double.NaN)), totalPrice = 1.0)
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            NfcePayloadValidator.validateScrapedData(
                dataWith(listOf(item(price = Double.POSITIVE_INFINITY)), totalPrice = 1.0)
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            NfcePayloadValidator.validateScrapedData(
                dataWith(
                    listOf(item().copy(quantity = Double.NaN)),
                    totalPrice = 1.0
                )
            )
        }
    }

    @Test
    fun `total declarado prevalece quando difere por desconto`() {
        // Itens somam 100, nota declara 90 (desconto de 10).
        val result = NfcePayloadValidator.validateScrapedData(
            dataWith(listOf(item(price = 100.0)), totalPrice = 90.0)
        )

        assertEquals(90.0, result.totalPrice, 0.001)
    }

    @Test
    fun `total declarado positivo e autoritativo`() {
        val result = NfcePayloadValidator.validateScrapedData(
            dataWith(listOf(item(price = 89.95)), totalPrice = 90.0)
        )

        assertEquals(90.0, result.totalPrice, 0.001)
    }

    @Test
    fun `total declarado nao finito cai para a soma dos itens`() {
        val nan = NfcePayloadValidator.validateScrapedData(
            dataWith(listOf(item(price = 10.0)), totalPrice = Double.NaN)
        )
        val infinite = NfcePayloadValidator.validateScrapedData(
            dataWith(listOf(item(price = 10.0)), totalPrice = Double.POSITIVE_INFINITY)
        )

        assertEquals(10.0, nan.totalPrice, 0.001)
        assertEquals(10.0, infinite.totalPrice, 0.001)
    }

    @Test
    fun `total declarado maior que a soma dos itens prevalece`() {
        val result = NfcePayloadValidator.validateScrapedData(
            dataWith(listOf(item(price = 90.0)), totalPrice = 100.0)
        )

        assertEquals(100.0, result.totalPrice, 0.001)
    }

    @Test
    fun `total ausente cai para a soma dos itens`() {
        val result = NfcePayloadValidator.validateScrapedData(
            dataWith(listOf(item(price = 10.0), item(price = 5.0)), totalPrice = 0.0)
        )

        assertEquals(15.0, result.totalPrice, 0.001)
    }
}
