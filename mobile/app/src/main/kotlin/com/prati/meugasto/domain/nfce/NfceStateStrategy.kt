package com.prati.meugasto.domain.nfce

interface NfceStateStrategy {
    val stateCode: String // ex: "43" (RS), "33" (RJ)
    val stateUf: String   // ex: "RS", "RJ"
    val allowedHosts: List<String>

    fun canHandle(url: String): Boolean
    fun parseHtml(html: String, originalUrl: String): NfceScrapedData
}

