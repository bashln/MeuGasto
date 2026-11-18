package com.prati.meugasto.domain.model

import org.junit.Assert.assertEquals
import org.junit.Test

class EstablishmentDetectorTest {

    @Test
    fun testDetectsPharmacies() {
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Farmácias São João"))
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Droga Raia Filial 102"))
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Drogasil S.A."))
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Panvel Farmácias"))
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Farmácia e Drogaria Nissei"))
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Pague Menos Drogarias"))
        assertEquals(EstablishmentType.PHARMACY, EstablishmentDetector.detectType("Drogaria Venancio"))
    }

    @Test
    fun testDetectsGasStations() {
        assertEquals(EstablishmentType.GAS_STATION, EstablishmentDetector.detectType("Posto Ipiranga Rodoil"))
        assertEquals(EstablishmentType.GAS_STATION, EstablishmentDetector.detectType("Auto Posto Shell Central"))
        assertEquals(EstablishmentType.GAS_STATION, EstablishmentDetector.detectType("Petrobras Distribuidora"))
        assertEquals(EstablishmentType.GAS_STATION, EstablishmentDetector.detectType("Comércio de Combustíveis Ltda"))
        assertEquals(EstablishmentType.GAS_STATION, EstablishmentDetector.detectType("Abastecedora de Combustíveis Silva"))
        assertEquals(EstablishmentType.GAS_STATION, EstablishmentDetector.detectType("Posto Ale 24h"))
    }

    @Test
    fun testDetectsSupermarkets() {
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Supermercado Zaffari"))
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Carrefour Hipermercado"))
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Assaí Atacadista"))
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Atacadão S.A."))
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Pão de Açúcar"))
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Minimercado da Esquina"))
    }

    @Test
    fun testDefaultsToSupermarketForGeneralStores() {
        assertEquals(EstablishmentType.SUPERMARKET, EstablishmentDetector.detectType("Comercial de Alimentos"))
    }
}
