package com.prati.meugasto.domain.nfce.strategies

import com.prati.meugasto.domain.nfce.NfcePayloadValidator
import com.prati.meugasto.domain.nfce.NfceScrapedData
import com.prati.meugasto.domain.nfce.NfceScrapedItem
import com.prati.meugasto.domain.nfce.NfceStateStrategy
import com.prati.meugasto.domain.nfce.NfceSupermarketInfo
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RjNfceStrategy : NfceStateStrategy {
    override val stateCode: String = "33"
    override val stateUf: String = "RJ"
    override val allowedHosts: List<String> = listOf(
        "consultadfe.fazenda.rj.gov.br",
        "nfce.fazenda.rj.gov.br"
    )

    override fun canHandle(url: String): Boolean {
        return allowedHosts.any { url.contains(it) } || url.contains("p=33")
    }

    override fun parseHtml(html: String, originalUrl: String): NfceScrapedData {
        val accessKeyFromUrl = Regex("p=([0-9]{44})").find(originalUrl)?.groupValues?.get(1)
        val accessKeyFromHtml = Regex("([0-9]{4}\\s*){11}").find(html)?.value?.replace("\\s".toRegex(), "")
        val accessKey = accessKeyFromUrl ?: accessKeyFromHtml ?: ""

        val storeRegex = Regex("(?i)<(?:div|span)[^>]*class=[\"'][^\"']*txtTopo[^\"']*[\"'][^>]*>([^<]+)<")
        val supermarketName = storeRegex.find(html)?.groupValues?.get(1)?.trim() ?: "Supermercado (RJ)"

        val cnpjRegex = Regex("\\b\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}\\b")
        val cnpj = cnpjRegex.find(html)?.value

        val items = mutableListOf<NfceScrapedItem>()
        // Tabela #tabResult do portal SEFAZ-RJ
        val rjItemRegex = Regex("(?is)<span[^>]*class=[\"'][^\"']*txtFixa[^\"']*[\"'][^>]*>(.*?)</span>.*?<span[^>]*class=[\"'][^\"']*Rqtd[^\"']*[\"'][^>]*>.*?([0-9.,]+).*?</span>.*?<span[^>]*class=[\"'][^\"']*RUN[^\"']*[\"'][^>]*>.*?([a-zA-Z]+).*?</span>.*?<span[^>]*class=[\"'][^\"']*RVALOR[^\"']*[\"'][^>]*>.*?([0-9.,]+).*?</span>")

        for (match in rjItemRegex.findAll(html)) {
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

        val totalRegex = Regex("(?i)(?:Valor a pagar|Valor total)[^0-9]*(\\d+[.,]\\d{2})")
        val totalMatch = totalRegex.find(html)?.groupValues?.get(1)?.replace(",", ".")
        val candidateTotal = totalMatch?.toDoubleOrNull()
        val itemsSum = items.sumOf { it.price }

        val total = when {
            candidateTotal != null && candidateTotal > 0.0 && !(items.size > 1 && candidateTotal == items.first().price && candidateTotal < itemsSum) -> candidateTotal
            itemsSum > 0.0 -> itemsSum
            else -> candidateTotal ?: 0.0
        }

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

        val rawData = NfceScrapedData(
            accessKey = accessKey,
            supermarket = NfceSupermarketInfo(
                name = supermarketName,
                cnpj = cnpj,
                state = "RJ"
            ),
            items = items,
            totalPrice = total,
            date = today
        )

        return NfcePayloadValidator.validateScrapedData(rawData)
    }
}

