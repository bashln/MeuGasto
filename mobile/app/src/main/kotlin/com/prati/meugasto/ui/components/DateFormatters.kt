package com.prati.meugasto.ui.components

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Utilitários de formatação de data em pt-BR para datas ISO "yyyy-MM-dd"
 * usadas pelo app (NFC-e e banco local).
 */
object DateFormatters {
    private val ptBr = Locale("pt", "BR")

    private fun parseOrNull(date: String): LocalDate? = try {
        LocalDate.parse(date)
    } catch (_: Exception) {
        null
    }

    /** "16/09" — rótulos compactos para eixos de gráficos. */
    fun chartLabel(date: String): String {
        val parsed = parseOrNull(date) ?: return date.takeLast(5).replace('-', '/')
        return parsed.format(DateTimeFormatter.ofPattern("dd/MM"))
    }

    /** "Hoje", "Ontem" ou "16 de set. de 2026" — linhas de lista e detalhes. */
    fun friendly(date: String): String {
        val parsed = parseOrNull(date) ?: return date
        val today = LocalDate.now()
        return when (parsed) {
            today -> "Hoje"
            today.minusDays(1) -> "Ontem"
            else -> parsed.format(DateTimeFormatter.ofPattern("d 'de' MMM 'de' yyyy", ptBr))
        }
    }

    /** "16 de setembro de 2026" — cabeçalhos de seção. */
    fun longLabel(date: String): String {
        val parsed = parseOrNull(date) ?: return date
        return parsed.format(DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", ptBr))
    }
}
