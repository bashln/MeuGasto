package com.prati.meugasto.domain.nfce

import java.text.SimpleDateFormat
import java.util.Locale

object NfcePortalDataParser {
    private val currencyPattern = Regex("""(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+)[,.]\d{2}(?!\d)""")
    private val emissionDatePattern = Regex("""(?is)Emiss(?:&atilde;|ã|a)o\s*:?[^0-9]*(\d{2}/\d{2}/\d{4})""")

    fun parseCurrency(text: String): Double? {
        val value = currencyPattern.find(text)?.value ?: return null
        val normalized = if (value.contains(',')) {
            value.replace(".", "").replace(',', '.')
        } else {
            value
        }
        return normalized.toDoubleOrNull()
    }

    fun parseEmissionDate(html: String): String? {
        val dateText = emissionDatePattern.find(html)?.groupValues?.get(1) ?: return null
        return runCatching {
            SimpleDateFormat("dd/MM/yyyy", Locale.ROOT).apply { isLenient = false }
                .parse(dateText)
                ?.let { SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(it) }
        }.getOrNull()
    }
}
