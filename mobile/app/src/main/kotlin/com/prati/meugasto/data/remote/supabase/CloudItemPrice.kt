package com.prati.meugasto.data.remote.supabase

import java.math.BigDecimal
import java.math.RoundingMode

internal object CloudItemPrice {
    fun toCloudUnitPrice(lineTotal: Double, quantity: Double): Double {
        val safeQuantity = quantity.takeIf { it.isFinite() && it > 0.0 } ?: 1.0
        return BigDecimal.valueOf(lineTotal)
            .divide(BigDecimal.valueOf(safeQuantity), 2, RoundingMode.HALF_UP)
            .toDouble()
    }

    fun toLocalLineTotal(unitPrice: Double, quantity: Double): Double {
        val safeQuantity = quantity.takeIf { it.isFinite() && it > 0.0 } ?: 1.0
        return BigDecimal.valueOf(unitPrice)
            .multiply(BigDecimal.valueOf(safeQuantity))
            .setScale(2, RoundingMode.HALF_UP)
            .toDouble()
    }
}
