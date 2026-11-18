package com.prati.meugasto.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EmptyStateResolutionTest {

    data class PurchasesEmptyStateConfig(
        val title: String,
        val description: String,
        val actionLabel: String
    )

    private fun resolvePurchasesEmptyState(hasFilter: Boolean): PurchasesEmptyStateConfig {
        return if (hasFilter) {
            PurchasesEmptyStateConfig(
                title = "Nenhum resultado encontrado",
                description = "Tente ajustar ou limpar seus filtros de busca.",
                actionLabel = "Limpar Filtros"
            )
        } else {
            PurchasesEmptyStateConfig(
                title = "Nenhuma compra registrada",
                description = "Escaneie sua primeira nota fiscal para começar a acompanhar seus gastos.",
                actionLabel = "Escanear Nota Fiscal"
            )
        }
    }

    private fun hasReportData(spendingByDateCount: Int, spendingByMarketCount: Int): Boolean {
        return spendingByDateCount > 0 || spendingByMarketCount > 0
    }

    @Test
    fun purchasesEmptyStateWithoutFilterShowsScannerAction() {
        val config = resolvePurchasesEmptyState(hasFilter = false)
        assertEquals("Nenhuma compra registrada", config.title)
        assertEquals("Escanear Nota Fiscal", config.actionLabel)
    }

    @Test
    fun purchasesEmptyStateWithFilterShowsClearFilterAction() {
        val config = resolvePurchasesEmptyState(hasFilter = true)
        assertEquals("Nenhum resultado encontrado", config.title)
        assertEquals("Limpar Filtros", config.actionLabel)
    }

    @Test
    fun reportsEmptyStateTriggersOnlyWhenBothDatasetsAreEmpty() {
        assertFalse(hasReportData(spendingByDateCount = 0, spendingByMarketCount = 0))
        assertTrue(hasReportData(spendingByDateCount = 1, spendingByMarketCount = 0))
        assertTrue(hasReportData(spendingByDateCount = 0, spendingByMarketCount = 2))
        assertTrue(hasReportData(spendingByDateCount = 3, spendingByMarketCount = 4))
    }
}
