package com.prati.meugasto.domain.nfce

import com.prati.meugasto.domain.nfce.strategies.RjNfceStrategy
import com.prati.meugasto.domain.nfce.strategies.RsNfceStrategy

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

    fun findStrategy(url: String): NfceStateStrategy? = strategies.firstOrNull { it.canHandle(url) }

    fun supportedUfs(): List<String> = strategies.map { it.stateUf }
}