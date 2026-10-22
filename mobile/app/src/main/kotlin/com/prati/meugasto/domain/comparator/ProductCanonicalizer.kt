package com.prati.meugasto.domain.comparator

object ProductCanonicalizer {
    fun canonicalKey(name: String, code: String? = null): String {
        val trimmedCode = code?.trim().orEmpty()
        if (trimmedCode.isNotBlank()) return "code:$trimmedCode"
        return "name:${StringMatcher.normalize(name)}"
    }

    fun areSameProduct(a: String, b: String, threshold: Double = 0.8): Boolean {
        if (StringMatcher.normalize(a) == StringMatcher.normalize(b)) return true
        return StringMatcher.calculateSimilarity(a, b) >= threshold
    }
}