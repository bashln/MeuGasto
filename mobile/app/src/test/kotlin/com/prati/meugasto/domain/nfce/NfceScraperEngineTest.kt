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
    fun testRsStrategyParsesMultiItemInvoiceCorrectlyWithoutMatchingFirstItemTotal() {
        val strategy = RsNfceStrategy()
        // Mock HTML resembling Zaffari with multiple items and table headers mentioning "Total"
        val mockHtml = """
            <html>
                <div class="txtTopo">Comercial Zaffari Ltda Filial 23</div>
                <span class="text">CNPJ: 92.016.757/0073-66</span>
                <span class="chave">4326 0992 0167 5700 7366 6510 4000 3070 4419 8888 7777</span>
                <table class="tabela">
                    <thead><tr><th>Descricao</th><th>Qtd</th><th>UN</th><th>Vl. Unit.</th><th>Total</th></tr></thead>
                    <tbody>
                        <tr id="Item + 1">
                            <td><span class="txtTit">PAPEL HIG NOTAVEL 30M C32 PREM F DUP EMB ECON=</span>
                                <span class="Rqtd"><strong>Qtde.:</strong>2</span>
                                <span class="RUN"><strong>UN: </strong>UN1</span>
                                <span class="RvlUnit"><strong>Vl. Unit.:</strong> 38,90</span>
                            </td>
                            <td><span class="valor">77,80</span></td>
                        </tr>
                        <tr id="Item + 2">
                            <td><span class="txtTit">LEITE ELEGE 1L UHT INT =</span>
                                <span class="Rqtd"><strong>Qtde.:</strong>12</span>
                                <span class="RUN"><strong>UN: </strong>UN1</span>
                                <span class="RvlUnit"><strong>Vl. Unit.:</strong> 4,79</span>
                            </td>
                            <td><span class="valor">57,48</span></td>
                        </tr>
                        <tr id="Item + 3">
                            <td><span class="txtTit">QUEIJO FRIOLACK 700G MUSSAR FAT</span>
                                <span class="Rqtd"><strong>Qtde.:</strong>1</span>
                                <span class="RUN"><strong>UN: </strong>UN1</span>
                                <span class="RvlUnit"><strong>Vl. Unit.:</strong> 31,99</span>
                            </td>
                            <td><span class="valor">31,99</span></td>
                        </tr>
                    </tbody>
                </table>
                <div id="totalNota" class="txtMax">
                    <div id="linhaTotal"><label>Valor total R$:</label><span class="totalNumb txtMax">167,27</span></div>
                    <div id="linhaTotal"><label>Descontos R$:</label><span class="totalNumb txtMax">10,00</span></div>
                    <div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">157,27</span></div>
                </div>
                <div>Emissão: 01/08/2026 15:12:00</div>
            </html>
        """.trimIndent()

        val url = "https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260992016757007366651040003070441988887777"
        val data = strategy.parseHtml(mockHtml, url)

        assertEquals("Comercial Zaffari Ltda Filial 23", data.supermarket.name)
        assertEquals(3, data.items.size)
        assertEquals("PAPEL HIG NOTAVEL 30M C32 PREM F DUP EMB ECON=", data.items[0].name)
        assertEquals(77.80, data.items[0].price, 0.01)
        // Must NOT be 77.80 (the first item's price)
        assertEquals(157.27, data.totalPrice, 0.01)
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

