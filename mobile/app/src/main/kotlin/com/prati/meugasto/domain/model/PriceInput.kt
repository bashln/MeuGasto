package com.prati.meugasto.domain.model

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Interpreta valores monetários digitados pelo usuário (vírgula ou ponto).
 * Rejeita negativos, NaN e infinitos para que não cheguem ao banco.
 *
 * Preços são arredondados para centavos (HALF_UP), evitando ruído de ponto
 * flutuante em valores com mais de duas casas. A representação continua em
 * `Double`; a avaliação de migração para `BigDecimal` está registrada em
 * `docs/PLAN_MELHORIAS.md`.
 */
object PriceInput {
    fun parseEstimatedPrice(input: String): Double? {
        val normalized = input.trim().replace(',', '.')
        if (normalized.isBlank()) return null
        val value = normalized.toDoubleOrNull() ?: return null
        if (!value.isFinite() || value < 0.0) return null
        return BigDecimal.valueOf(value)
            .setScale(2, RoundingMode.HALF_UP)
            .toDouble()
    }

    fun parseQuantity(input: String): Double? {
        val normalized = input.trim().replace(',', '.')
        if (normalized.isBlank()) return null
        val value = normalized.toDoubleOrNull() ?: return null
        return value.takeIf { it.isFinite() && it > 0.0 }
    }
}
