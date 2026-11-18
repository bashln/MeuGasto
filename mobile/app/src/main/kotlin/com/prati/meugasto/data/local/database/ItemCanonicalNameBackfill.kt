package com.prati.meugasto.data.local.database

import com.prati.meugasto.domain.comparator.ProductCanonicalizer

/**
 * Backfill de [ItemEntity.canonicalName] para registros criados antes da versão 6.
 *
 * A migration 5→6 precisa produzir exatamente a mesma chave que
 * [ProductCanonicalizer.canonicalKey] gera para novas compras. Manter essa
 * lógica fora do SQL permite testá-la na JVM e evita divergência de regras
 * (trim, acentos, pontuação e abreviações).
 */
internal object ItemCanonicalNameBackfill {
    data class Row(
        val id: Long,
        val name: String,
        val code: String?
    )

    fun canonicalNames(rows: List<Row>): Map<Long, String> =
        rows.associate { row ->
            row.id to ProductCanonicalizer.canonicalKey(row.name, row.code)
        }
}
