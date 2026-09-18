package com.prati.meugasto.domain.comparator

import java.text.Normalizer
import kotlin.math.max
import kotlin.math.min

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

    private val EXCLUSION_MODIFIERS = setOf(
        "condensado",
        "coco",
        "queijo",
        "po",
        "creme",
        "frances",
        "forma"
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

    fun levenshteinDistance(s1: String, s2: String): Int {
        val m = s1.length
        val n = s2.length
        val dp = Array(m + 1) { IntArray(n + 1) }

        for (i in 0..m) dp[i][0] = i
        for (j in 0..n) dp[0][j] = j

        for (i in 1..m) {
            for (j in 1..n) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,
                    min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
                )
            }
        }
        return dp[m][n]
    }

    fun calculateSimilarity(target: String, candidate: String): Double {
        val normTarget = normalize(target)
        val normCand = normalize(candidate)

        if (normTarget.isBlank() || normCand.isBlank()) return 0.0
        if (normTarget == normCand) return 1.0

        val targetTokens = normTarget.split(" ").filter { it.length > 1 }
        val candTokens = normCand.split(" ").filter { it.length > 1 }

        if (targetTokens.isEmpty() || candTokens.isEmpty()) return 0.0

        // Penalização para modificadores de exclusão (ex: leite vs leite condensado)
        val targetHasExclusions = targetTokens.any { EXCLUSION_MODIFIERS.contains(it) }
        val candHasExclusions = candTokens.any { EXCLUSION_MODIFIERS.contains(it) }
        if (!targetHasExclusions && candHasExclusions) {
            return 0.1
        }

        // Casamento de tokens
        var matched = 0
        for (t in targetTokens) {
            val bestTokenScore = candTokens.maxOfOrNull { c ->
                if (t == c) 1.0
                else {
                    val dist = levenshteinDistance(t, c)
                    val maxLen = max(t.length, c.length)
                    if (maxLen == 0) 1.0 else 1.0 - (dist.toDouble() / maxLen)
                }
            } ?: 0.0

            if (bestTokenScore >= 0.75) {
                matched++
            }
        }

        return matched.toDouble() / targetTokens.size.toDouble()
    }
}

