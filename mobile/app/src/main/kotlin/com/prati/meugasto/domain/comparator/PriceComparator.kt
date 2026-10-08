package com.prati.meugasto.domain.comparator

enum class UnitCategory {
    WEIGHT,
    VOLUME,
    COUNT,
    UNKNOWN
}

data class NormalizedUnitInfo(
    val category: UnitCategory,
    val baseUnit: String,
    val factorToBase: Double
)

data class ComparisonCandidate(
    val name: String,
    val price: Double,
    val quantity: Double,
    val unit: String
)

data class ItemComparisonResult(
    val isComparable: Boolean,
    val standardUnit: String? = null,
    val unitPrice1: Double? = null,
    val unitPrice2: Double? = null,
    val cheaperIndex: Int? = null, // 1 for first item, 2 for second item, null if equal or incompatible
    val savingsPercentage: Double? = null,
    val priceDiffPerBase: Double? = null,
    val message: String
)

object PriceComparator {

    private val UNIT_REGISTRY = mapOf(
        // Peso (Base: kg)
        "kg" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 1.0),
        "quilo" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 1.0),
        "kilo" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 1.0),
        "g" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 0.001),
        "gr" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 0.001),
        "grama" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 0.001),
        "gramas" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 0.001),
        "mg" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 0.000001),
        "lb" to NormalizedUnitInfo(UnitCategory.WEIGHT, "kg", 0.453592),

        // Volume (Base: L)
        "l" to NormalizedUnitInfo(UnitCategory.VOLUME, "L", 1.0),
        "lt" to NormalizedUnitInfo(UnitCategory.VOLUME, "L", 1.0),
        "litro" to NormalizedUnitInfo(UnitCategory.VOLUME, "L", 1.0),
        "litros" to NormalizedUnitInfo(UnitCategory.VOLUME, "L", 1.0),
        "ml" to NormalizedUnitInfo(UnitCategory.VOLUME, "L", 0.001),
        "mililitro" to NormalizedUnitInfo(UnitCategory.VOLUME, "L", 0.001),

        // Unidade / Contagem (Base: un)
        "un" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "un." to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "und" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "unid" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "unidade" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "unidades" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "pct" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "pacote" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 1.0),
        "dz" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 12.0),
        "duzia" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 12.0),
        "dúzia" to NormalizedUnitInfo(UnitCategory.COUNT, "un", 12.0)
    )

    fun getUnitInfo(unit: String): NormalizedUnitInfo? {
        val clean = unit.trim().lowercase()
        return UNIT_REGISTRY[clean]
    }

    fun calculatePricePerBaseUnit(price: Double, quantity: Double, unit: String): Double? {
        if (price < 0.0 || quantity <= 0.0) return null
        val unitInfo = getUnitInfo(unit) ?: return null
        val totalBaseUnits = quantity * unitInfo.factorToBase
        return if (totalBaseUnits > 0.0) price / totalBaseUnits else null
    }

    fun compare(item1: ComparisonCandidate, item2: ComparisonCandidate): ItemComparisonResult {
        if (item1.price < 0.0 || item1.quantity <= 0.0 || item2.price < 0.0 || item2.quantity <= 0.0) {
            return ItemComparisonResult(
                isComparable = false,
                message = "Valores de preço ou quantidade inválidos para comparação."
            )
        }

        val info1 = getUnitInfo(item1.unit)
        val info2 = getUnitInfo(item2.unit)

        if (info1 == null || info2 == null) {
            return ItemComparisonResult(
                isComparable = false,
                message = "Unidade de medida não suportada para comparação."
            )
        }

        if (info1.category != info2.category) {
            return ItemComparisonResult(
                isComparable = false,
                message = "Itens com grandezas diferentes não podem ser comparados (ex: peso vs volume)."
            )
        }

        val price1PerBase = calculatePricePerBaseUnit(item1.price, item1.quantity, item1.unit) ?: return ItemComparisonResult(
            isComparable = false,
            message = "Erro ao calcular preço por unidade base do primeiro item."
        )
        val price2PerBase = calculatePricePerBaseUnit(item2.price, item2.quantity, item2.unit) ?: return ItemComparisonResult(
            isComparable = false,
            message = "Erro ao calcular preço por unidade base do segundo item."
        )

        val baseUnit = info1.baseUnit
        val diff = Math.abs(price1PerBase - price2PerBase)

        if (diff < 0.0001) {
            return ItemComparisonResult(
                isComparable = true,
                standardUnit = baseUnit,
                unitPrice1 = price1PerBase,
                unitPrice2 = price2PerBase,
                cheaperIndex = null,
                savingsPercentage = 0.0,
                priceDiffPerBase = 0.0,
                message = "Ambos os itens possuem o mesmo custo por $baseUnit."
            )
        }

        val cheaperIndex = if (price1PerBase < price2PerBase) 1 else 2
        val higher = Math.max(price1PerBase, price2PerBase)
        val lower = Math.min(price1PerBase, price2PerBase)
        val savingsPct = ((higher - lower) / higher) * 100.0
        val cheaperName = if (cheaperIndex == 1) item1.name else item2.name

        return ItemComparisonResult(
            isComparable = true,
            standardUnit = baseUnit,
            unitPrice1 = price1PerBase,
            unitPrice2 = price2PerBase,
            cheaperIndex = cheaperIndex,
            savingsPercentage = savingsPct,
            priceDiffPerBase = diff,
            message = "$cheaperName tem o melhor custo-benefício por $baseUnit."
        )
    }
}
