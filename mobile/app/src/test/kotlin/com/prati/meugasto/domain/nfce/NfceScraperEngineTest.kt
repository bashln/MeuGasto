package com.prati.meugasto.domain.nfce

import com.prati.meugasto.domain.nfce.strategies.RjNfceStrategy
import com.prati.meugasto.domain.nfce.strategies.RsNfceStrategy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NfceScraperEngineTest {

    @Test
    fun testRsStrategyParsesValidHtml() {
        val strategy = RsNfceStrategy()
        val mockHtml = """
            <html>
                <div class="txtTopo">Supermercado Zaffari</div>
                <span class="text">CNPJ: 93.015.006/0001-13</span>
                <span class="chave">4326 0993 0150 0600 0113 6510 4000 3070 4419 9999 9999</span>
                <table>
                    <tr id="Item + 1">
                        <td><span class="txtTit">ARROZ BRANCO 5KG</span>
                            <span class="Rqtd"><strong>Qtde.:</strong>1</span>
                            <span class="RUN"><strong>UN: </strong>UN1</span>
                            <span class="RvlUnit"><strong>Vl. Unit.:</strong> 24,90</span>
                        </td>
                        <td><span class="valor">24,90</span></td>
                    </tr>
                </table>
                <div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">24,90</span></div>
                <div>Emissão: 01/08/2026 09:30:31</div>
            </html>
        """.trimIndent()

        val url = "https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260993015006000113651040003070441999999999"
        val data = strategy.parseHtml(mockHtml, url)

        assertEquals("Supermercado Zaffari", data.supermarket.name)
        assertEquals("43260993015006000113651040003070441999999999", data.accessKey)
        assertEquals(1, data.items.size)
        assertEquals("ARROZ BRANCO 5KG", data.items[0].name)
        assertEquals(24.90, data.items[0].price, 0.01)
        assertEquals(24.90, data.totalPrice, 0.01)
    }

    @Test
    fun testRjStrategyParsesValidHtml() {
        val strategy = RjNfceStrategy()
        val mockHtml = """
            <html>
                <div class="txtTopo">Supermercado Guanabara</div>
                <table>
                    <tr>
                        <span class="txtFixa">FEIJAO PRETO 1KG</span>
                        <span class="Rqtd">2</span>
                        <span class="RUN">UN</span>
                        <span class="RVALOR">15.80</span>
                    </tr>
                </table>
                <span>Valor total R$ 15,80</span>
            </html>
        """.trimIndent()

        val url = "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/paginas/consultaQRCode.faces?p=33260993015006000113651040003070441999999999"
        val data = strategy.parseHtml(mockHtml, url)

        assertEquals("Supermercado Guanabara", data.supermarket.name)
        assertEquals(1, data.items.size)
        assertEquals("FEIJAO PRETO 1KG", data.items[0].name)
        assertEquals(15.80, data.items[0].price, 0.01)
    }

    @Test(expected = IllegalArgumentException::class)
    fun testValidatorRejectsInvalidKey() {
        NfcePayloadValidator.validateAccessKey("123") // Too short
    }
}

