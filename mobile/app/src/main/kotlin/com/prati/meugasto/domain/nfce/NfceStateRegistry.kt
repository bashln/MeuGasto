package com.prati.meugasto.domain.nfce

import com.prati.meugasto.domain.nfce.strategies.RjNfceStrategy
import com.prati.meugasto.domain.nfce.strategies.RsNfceStrategy
import java.net.URI

data class NfceStateMetadata(
    val stateCode: String,
    val stateUf: String,
    val allowedHosts: List<String>
)

object NfceStateRegistry {
    val strategies: List<NfceStateStrategy> = listOf(
        RsNfceStrategy(),
        RjNfceStrategy()
    )

    val metadata: List<NfceStateMetadata> = strategies.map {
        NfceStateMetadata(it.stateCode, it.stateUf, it.allowedHosts)
    }

    private val ibgeCodeToUf: Map<String, String> = mapOf(
        "11" to "RO",
        "12" to "AC",
        "13" to "AM",
        "14" to "RR",
        "15" to "PA",
        "16" to "AP",
        "17" to "TO",
        "21" to "MA",
        "22" to "PI",
        "23" to "CE",
        "24" to "RN",
        "25" to "PB",
        "26" to "PE",
        "27" to "AL",
        "28" to "SE",
        "29" to "BA",
        "31" to "MG",
        "32" to "ES",
        "33" to "RJ",
        "35" to "SP",
        "41" to "PR",
        "42" to "SC",
        "43" to "RS",
        "50" to "MS",
        "51" to "MT",
        "52" to "GO",
        "53" to "DF"
    )

    private val knownBrazilianUfs: Set<String> = ibgeCodeToUf.values.toSet()

    fun findStrategy(url: String): NfceStateStrategy? = strategies.firstOrNull { it.canHandle(url) }

    fun supportedUfs(): List<String> = strategies.map { it.stateUf }

    fun promoteKnownPortalToHttps(
        rawUrl: String,
        activeStrategies: List<NfceStateStrategy> = strategies
    ): String {
        val trimmed = normalizeQrUrl(rawUrl)
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return trimmed
        if (!uri.scheme.equals("http", ignoreCase = true)) return trimmed
        val host = uri.host ?: return trimmed
        val isKnownPortalHost = activeStrategies.any { strategy ->
            strategy.allowedHosts.any { allowed -> allowed.equals(host, ignoreCase = true) }
        }
        if (!isKnownPortalHost) return trimmed
        return runCatching {
            URI(
                "https",
                uri.userInfo,
                host,
                if (uri.port == 80) -1 else uri.port,
                uri.path,
                uri.query,
                uri.fragment
            ).toString()
        }.getOrDefault(trimmed)
    }

    /** NFC-e QR payloads commonly contain raw pipes, which java.net.URI rejects. */
    fun normalizeQrUrl(rawUrl: String): String = rawUrl.trim().replace("|", "%7C")

    fun detectUfFromUrl(rawUrl: String): String? {
        val keyMatch = Regex("(?:[?&](?:p|chNFe)=|\\b)([0-9]{2})[0-9]{42}\\b").find(rawUrl)
        val fromKey = keyMatch?.groupValues?.get(1)?.let(ibgeCodeToUf::get)
        if (fromKey != null) return fromKey

        val host = runCatching { URI(rawUrl.trim()).host?.lowercase() }.getOrNull() ?: return null
        val hostUf = Regex("\\.([a-z]{2})\\.gov\\.br$").find(host)?.groupValues?.get(1)?.uppercase()
        return hostUf?.takeIf { it in knownBrazilianUfs }
    }
}
