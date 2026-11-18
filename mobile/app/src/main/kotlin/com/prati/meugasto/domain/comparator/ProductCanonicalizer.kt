package com.prati.meugasto.domain.comparator

object ProductCanonicalizer {
    fun canonicalKey(name: String, code: String? = null): String {
        val trimmedCode = code?.trim().orEmpty()
        if (trimmedCode.isNotBlank()) return "code:$trimmedCode"
        return "name:${StringMatcher.normalize(name)}"
    }
}