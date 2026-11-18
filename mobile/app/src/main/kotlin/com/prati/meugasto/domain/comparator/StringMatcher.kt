package com.prati.meugasto.domain.comparator

import java.text.Normalizer

object StringMatcher {

    private val ABBREVIATIONS = mapOf(
        "refrig" to "refrigerante",
        "refri" to "refrigerante",
        "det" to "detergente",
        "sab" to "sabao",
        "lavat" to "sabao",
        "cond" to "condensado",
        "choc" to "chocolate",
        "bisc" to "biscoito",
        "bolach" to "biscoito",
        "cerv" to "cerveja",
        "maca" to "maca",
        "int" to "integral",
        "desn" to "desnatado"
    )

    fun normalize(text: String): String {
        val withoutAccents = Normalizer.normalize(text, Normalizer.Form.NFD)
            .replace("\\p{InCombiningDiacriticalMarks}+".toRegex(), "")
        return withoutAccents.lowercase()
            .replace("[^a-z0-9\\s]".toRegex(), " ")
            .split("\\s+".toRegex())
            .filter { it.isNotBlank() }
            .joinToString(" ") { token ->
                ABBREVIATIONS[token] ?: token
            }
    }
}
