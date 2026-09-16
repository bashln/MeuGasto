package com.prati.meugasto.domain.nfce.strategies

import com.prati.meugasto.domain.nfce.NfcePayloadValidator
import com.prati.meugasto.domain.nfce.NfceScrapedData
import com.prati.meugasto.domain.nfce.NfceScrapedItem
import com.prati.meugasto.domain.nfce.NfceStateStrategy
import com.prati.meugasto.domain.nfce.NfceSupermarketInfo
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RsNfceStrategy : NfceStateStrategy {
    override val stateCode: String = "43"
    override val stateUf: String = "RS"
    override val allowedHosts: List<String> = listOf(
        "dfe-portal.svrs.rs.gov.br",
        "www.sefaz.rs.gov.br",
        "sefaz.rs.gov.br"
    )

    override fun canHandle(url: String): Boolean {
        return allowedHosts.any { url.contains(it) } || url.contains("p=43")
    }

    override fun parseHtml(html: String, originalUrl: String): NfceScrapedData {
        // Extrair chave de 44 dígitos da URL ou do HTML
        val accessKeyFromUrl = Regex("p=([0-9]{44})").find(originalUrl)?.groupValues?.get(1)
        val accessKeyFromHtml = Regex("([0-9]{4}\\s*){11}").find(html)?.value?.replace("\\s".toRegex(), "")
        val accessKey = accessKeyFromUrl ?: accessKeyFromHtml ?: ""

        // Extrair nome do supermercado
        val storeRegex = Regex("(?i)<(?:div|span|h[1-6])[^>]*class=[\"'][^\"']*(?:NFCE_Cabecalho_Emitente_RazaoSocial|txtTopo|emitente)[^\"']*[\"'][^>]*>([^<]+)<")
        val storeMatch = storeRegex.find(html)?.groupValues?.get(1)?.trim()
        val supermarketName = storeMatch?.ifBlank { "Supermercado (RS)" } ?: "Supermercado (RS)"

        // Extrair CNPJ
        val cnpjRegex = Regex("\\b\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}\\b")
        val cnpj = cnpjRegex.find(html)?.value

        // Extrair itens
        val items = mutableListOf<NfceScrapedItem>()
        // Padrão de linhas de itens da SEFAZ-RS (HTML real verificado)
        val itemRowRegex = Regex(
            """(?is)<tr\s+id="Item[^"]*">.*?<span\s+class="txtTit">(.*?)</span>.*?<span\s+class="Rqtd"><strong>Qtde.:</strong>(\d+[.,]?\d*)</span>.*?<span\s+class="RUN"><strong>UN: </strong>(\S+)</span>.*?<span\s+class="valor">(\d+[.,]\d+)</span>.*?</tr>"""
        )
        
        for (match in itemRowRegex.findAll(html)) {
            val name = match.groupValues[1].replace("<[^>]*>".toRegex(), "").trim()
            val qtdStr = match.groupValues[2].replace(",", ".")
            val unit = match.groupValues[3].trim()
            val priceStr = match.groupValues[4].replace(",", ".")

            val qtd = qtdStr.toDoubleOrNull() ?: 1.0
            val price = priceStr.toDoubleOrNull() ?: 0.0

            if (name.isNotBlank() && price > 0.0) {
                items.add(
                    NfceScrapedItem(
                        name = name,
                        quantity = qtd,
                        unit = unit.ifBlank { "UN" },
                        price = price
                    )
                )
            }
        }
        // Extrair Total da compra (priorizar container oficial e "Valor a pagar")
        val containerRegex = Regex("""(?is)<(?:div|tr)[^>]*id=["'](?:linhaTotal|totalNota)["'][^>]*>.*?<span[^>]*class=["'][^"']*totalNumb[^"']*["'][^>]*>(\d+[.,]\d{2})</span>""")
        val containerTotal = containerRegex.findAll(html).lastOrNull()?.groupValues?.get(1)?.replace(",", ".")?.toDoubleOrNull()

        val valorPagarRegex = Regex("""(?i)Valor\s+a\s+pagar[^0-9]*(\d+[.,]\d{2})""")
        val valorPagar = valorPagarRegex.find(html)?.groupValues?.get(1)?.replace(",", ".")?.toDoubleOrNull()

        val valorTotalRegex = Regex("""(?i)Valor\s+total[^0-9]*(\d+[.,]\d{2})""")
        val valorTotal = valorTotalRegex.find(html)?.groupValues?.get(1)?.replace(",", ".")?.toDoubleOrNull()

        val itemsSum = items.sumOf { it.price }

        // Validação defensiva: se o valor encontrado coincidir exatamente com o 1º item e houver múltiplos itens com soma superior,
        // é um falso positivo capturado do cabeçalho ou célula de item da tabela
        val candidateTotal = valorPagar ?: containerTotal ?: valorTotal
        val total = when {
            candidateTotal != null && candidateTotal > 0.0 && !(items.size > 1 && candidateTotal == items.first().price && candidateTotal < itemsSum) -> candidateTotal
            itemsSum > 0.0 -> itemsSum
            else -> candidateTotal ?: 0.0
        }

        val dateRegex = Regex("(?i)Emissão:.*?(\\d{2}/\\d{2}/\\d{4})")
        val dateStr = dateRegex.find(html)?.groupValues?.get(1)
        val date = try {
            if (dateStr != null) {
                val parsed = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).parse(dateStr)
                SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(parsed!!)
            } else {
                SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            }
        } catch (_: Exception) {
            SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
        }
        val rawData = NfceScrapedData(
            accessKey = accessKey,
            supermarket = NfceSupermarketInfo(
                name = supermarketName,
                cnpj = cnpj,
                state = "RS"
            ),
            items = items,
            totalPrice = total,
            date = date
        )

        return NfcePayloadValidator.validateScrapedData(rawData)
    }
}

