# TODO: Comparação de Itens por Unidade de Medida

## Objetivo

Comparar produtos com diferentes unidades de medida para identificar qual é mais barato por unidade base (kg, g, L, ml, un).

## Exemplos de Casos

| Caso | Comparação | Resposta |
|------|-----------|----------|
| Peso | 1 kg R$ 15,00 vs 500g R$ 7,00 | 1kg = R$15/kg, 500g = R$14/kg → **500g mais barato** |
| Volume | 1L R$ 8,00 vs 500ml R$ 3,50 | 1L = R$8/L, 500ml = R$7/L → **500ml mais barato** |
| Unidade | 12 ovos R$ 12,00 vs 6 ovos R$ 5,50 | 12 = R$1/ovo, 6 = R$0,92/ovo → **6 ovos mais barato** |
| Peso misto | 1 kg R$ 20,00 vs 750g R$ 14,00 | 1kg = R$20/kg, 750g = R$18,67/kg → **750g mais barato** |

## Regras de Normalização

### Unidades de Peso
- Base: **gramas (g)**
- 1 kg = 1000g
- 1 lb = 453.592g
- 1@ = 15kg
- Output: R$/kg ou R$/g

### Unidades de Volume
- Base: **mililitros (ml)**
- 1 L = 1000ml
- 1 galão = 3785ml
- Output: R$/L ou R$/ml

### Unidades de Contagem
- Base: **unidade (un)**
- Dúzia = 12
- Meia dúzia = 6
- Pacote com N unidades = N
- Output: R$/un

## Implementação

### 1. Normalizador de Unidades

```kotlin
enum class UnitCategory { WEIGHT, VOLUME, COUNT, UNKNOWN }

data class NormalizedUnit(
    val category: UnitCategory,
    val baseUnit: String,      // "g", "ml", "un"
    val factorToBase: Double   // 1.0 para base, 1000 para kg→g, etc.
)

val UNIT_MAP = mapOf(
    // Peso
    "kg" to NormalizedUnit(WEIGHT, "g", 1000.0),
    "g" to NormalizedUnit(WEIGHT, "g", 1.0),
    "mg" to NormalizedUnit(WEIGHT, "g", 0.001),
    "lb" to NormalizedUnit(WEIGHT, "g", 453.592),
    "@" to NormalizedUnit(WEIGHT, "g", 15000.0),
    
    // Volume
    "l" to NormalizedUnit(VOLUME, "ml", 1000.0),
    "lt" to NormalizedUnit(VOLUME, "ml", 1000.0),
    "ml" to NormalizedUnit(VOLUME, "ml", 1.0),
    "gal" to NormalizedUnit(VOLUME, "ml", 3785.0),
    
    // Contagem
    "un" to NormalizedUnit(COUNT, "un", 1.0),
    "un." to NormalizedUnit(COUNT, "un", 1.0),
    "pct" to NormalizedUnit(COUNT, "un", 1.0),
    "dz" to NormalizedUnit(COUNT, "un", 12.0),
)
```

### 2. Cálculo de Preço por Unidade Base

```kotlin
fun pricePerBaseUnit(price: Double, quantity: Double, unit: String): Double? {
    val normalized = UNIT_MAP[unit.lowercase()] ?: return null
    val totalBaseUnits = quantity * normalized.factorToBase
    return if (totalBaseUnits > 0) price / totalBaseUnits else null
}
```

### 3. Comparação de Dois Itens

```kotlin
data class PriceComparison(
    val item1: ProductPrice,
    val item2: ProductPrice,
    val winner: Int,           // 1 ou 2
    val savings: Double,       // R$ economizados por unidade base
    val savingsPercent: Double // % mais barato
)

fun compareProducts(item1: ProductPrice, item2: ProductPrice): PriceComparison? {
    val unit1 = UNIT_MAP[item1.unit.lowercase()] ?: return null
    val unit2 = UNIT_MAP[item2.unit.lowercase()] ?: return null
    
    if (unit1.category != unit2.category) return null // Incompatível
    
    val perUnit1 = pricePerBaseUnit(item1.price, item1.quantity, item1.unit)
    val perUnit2 = pricePerBaseUnit(item2.price, item2.quantity, item2.unit)
    
    if (perUnit1 == null || perUnit2 == null) return null
    
    return if (perUnit1 <= perUnit2) {
        PriceComparison(item1, item2, 1, perUnit2 - perUnit1, ((perUnit2 - perUnit1) / perUnit2) * 100)
    } else {
        PriceComparison(item1, item2, 2, perUnit1 - perUnit2, ((perUnit1 - perUnit2) / perUnit1) * 100)
    }
}
```

### 4. UI — Tela de Comparação

```
┌─────────────────────────────────┐
│ Comparação de Preço             │
├─────────────────────────────────┤
│ Produto: LEITE ELEGE 1L         │
│ ┌─────────────────────────────┐ │
│ │ 1L    R$ 4,79   R$ 4,79/L  │ │
│ └─────────────────────────────┘ │
│              vs                 │
│ ┌─────────────────────────────┐ │
│ │ 500ml R$ 2,49   R$ 4,98/L  │ │
│ └─────────────────────────────┘ │
│                                 │
│ 🏆 1L é mais barato             │
│ Economia: R$ 0,19/L (3,8%)     │
│                                 │
│ Histórico de preços:            │
│ • 01/08: 1L = R$ 4,79          │
│ • 15/07: 500ml = R$ 2,49       │
└─────────────────────────────────┘
```

## Localização no Código

- **Modelo**: `mobile/app/src/main/kotlin/com/prati/meugasto/domain/model/Models.kt`
- **Utility**: `mobile/app/src/main/kotlin/com/prati/meugasto/domain/comparator/PriceComparator.kt` (novo)
- **UI**: `mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/reports/ComparisonScreen.kt` (novo)
- **DAO**: Adicionar query para buscar histórico de preços do mesmo produto
- **Navigation**: Adicionar rota `comparison/{productName}`

## Prioridade

**Fase 4** — Após consolidar a Fase 3 (analytics).

## Acceptance Criteria

- [ ] Normalizador aceita kg, g, mg, lb, @, L, lt, ml, gal, un, pct, dz
- [ ] Cálculo de R$/unidade base correto para todos os casos
- [ ] UI mostra comparação lado a lado com vencedor destacado
- [ ] Indica economia em R$ e %
- [ ] Histórico de preços do mesmo produto disponível
- [ ] Funciona para itens com mesma unidade (comparação direta)
- [ ] Rejeita comparação entre unidades incompatíveis (peso vs volume)
