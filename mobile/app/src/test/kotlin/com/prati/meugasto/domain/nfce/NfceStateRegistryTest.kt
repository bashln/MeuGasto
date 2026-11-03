package com.prati.meugasto.domain.nfce

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NfceStateRegistryTest {
    @Test
    fun `registry exposes implemented states`() {
        assertTrue(NfceStateRegistry.supportedUfs().containsAll(listOf("RS", "RJ")))
    }

    @Test
    fun `find strategy by url`() {
        val url = "https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260992016757007366651040003070441988887777"
        assertEquals("RS", NfceStateRegistry.findStrategy(url)?.stateUf)
    }

    @Test
    fun `find strategy by RJ url`() {
        val url = "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/paginas/consultaQRCode.faces?p=33260993015006000113651040003070441999999999"
        assertEquals("RJ", NfceStateRegistry.findStrategy(url)?.stateUf)
    }

    @Test
    fun `unsupported state has no strategy`() {
        assertNull(NfceStateRegistry.findStrategy("https://www.nfce.fazenda.sp.gov.br/qrcode?p=35260993015006000113651040003070441999999999"))
        assertNull(NfceStateRegistry.findStrategy("https://example.com/?p=43260993015006000113651040003070441999999999"))
    }

    @Test
    fun `metadata mirrors strategy catalog`() {
        assertEquals(NfceStateRegistry.supportedUfs(), NfceStateRegistry.metadata.map { it.stateUf })
        assertTrue(NfceStateRegistry.metadata.all { it.allowedHosts.isNotEmpty() })
    }

    @Test
    fun `http portal from a supported state is promoted to https`() {
        assertEquals(
            "https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260992016757007366651040003070441988887777",
            NfceStateRegistry.promoteKnownPortalToHttps(
                "http://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260992016757007366651040003070441988887777"
            )
        )
    }

    @Test
    fun `unknown host keeps its original scheme`() {
        assertEquals(
            "http://example.com/nota",
            NfceStateRegistry.promoteKnownPortalToHttps("http://example.com/nota")
        )
    }

    @Test
    fun `detects UF from the access key`() {
        assertEquals(
            "RS",
            NfceStateRegistry.detectUfFromUrl(
                "https://example.com/nota?p=43260992016757007366651040003070441988887777"
            )
        )
        assertEquals(
            "SP",
            NfceStateRegistry.detectUfFromUrl(
                "https://www.nfce.fazenda.sp.gov.br/qrcode?p=35260993015006000113651040003070441999999999"
            )
        )
    }

    @Test
    fun `detects UF from the state host when the key is absent`() {
        assertEquals(
            "RJ",
            NfceStateRegistry.detectUfFromUrl("https://consultadfe.fazenda.rj.gov.br/consultaNFCe/paginas/consultaQRCode.faces")
        )
        assertNull(NfceStateRegistry.detectUfFromUrl("https://example.com/nota"))
    }
}