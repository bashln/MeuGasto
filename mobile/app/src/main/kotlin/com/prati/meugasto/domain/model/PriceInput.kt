package com.prati.meugasto.domain.model

/**
 * Interpreta valores monetários digitados pelo usuário (vírgula ou ponto).
 * Rejeita negativos, NaN e infinitos para que não cheguem ao banco.
 */
object PriceInput {
    fun parseEstimatedPrice(input: String): Double? {
        val normalized = input.trim().replace(',', '.')
        if (normalized.isBlank()) return null
        val value = normalized.toDoubleOrNull() ?: return null
        return value.takeIf { it.isFinite() && it >= 0.0 }
    }

    fun parseQuantity(input: String): Double? {
        val normalized = input.trim().replace(',', '.')
        if (normalized.isBlank()) return null
        val value = normalized.toDoubleOrNull() ?: return null
        return value.takeIf { it.isFinite() && it > 0.0 }
    }
}
