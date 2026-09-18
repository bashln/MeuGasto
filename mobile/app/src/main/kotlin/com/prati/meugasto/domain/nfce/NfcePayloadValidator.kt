package com.prati.meugasto.domain.nfce

import kotlin.math.abs

object NfcePayloadValidator {
    const val MAX_ITEMS_PER_PURCHASE = 200
    const val MAX_ITEM_NAME_LENGTH = 200
    const val MAX_TEXT_FIELD_LENGTH = 150

    fun validateAccessKey(key: String): String {
        val sanitized = key.replace("\\D".toRegex(), "")
        if (sanitized.length != 44) {
            throw IllegalArgumentException("Chave NFC-e inválida: deve conter exatamente 44 dígitos.")
        }
        return sanitized
    }

    fun sanitizeText(text: String, maxLength: Int): String {
        return text.trim()
            .replace("[<>\"'%/\\\\]".toRegex(), "")
            .take(maxLength)
    }

    fun validateScrapedData(data: NfceScrapedData): NfceScrapedData {
        val validKey = validateAccessKey(data.accessKey)
        val validSupermarketName = sanitizeText(data.supermarket.name, MAX_TEXT_FIELD_LENGTH)
        if (validSupermarketName.isBlank()) {
            throw IllegalArgumentException("Nome do estabelecimento não identificado.")
        }

        if (data.items.isEmpty()) {
            throw IllegalArgumentException("Nenhum item válido encontrado na nota fiscal.")
        }

        if (data.items.size > MAX_ITEMS_PER_PURCHASE) {
            throw IllegalArgumentException("Nota excede o limite máximo de $MAX_ITEMS_PER_PURCHASE itens.")
        }

        val sanitizedItems = data.items.map { item ->
            val cleanName = sanitizeText(item.name, MAX_ITEM_NAME_LENGTH)
            if (cleanName.isBlank()) throw IllegalArgumentException("Item com nome vazio na nota fiscal.")
            if (item.quantity <= 0.0) throw IllegalArgumentException("Item '$cleanName' com quantidade inválida (${item.quantity}).")
            if (item.price < 0.0) throw IllegalArgumentException("Item '$cleanName' com preço negativo (${item.price}).")

            item.copy(
                name = cleanName,
                unit = sanitizeText(item.unit.uppercase(), 10).ifBlank { "UN" },
                price = (Math.round(item.price * 100.0) / 100.0)
            )
        }

        val calculatedTotal = sanitizedItems.sumOf { it.price }
        val declaredTotal = data.totalPrice

        // Se total declarado for 0 ou diferir ligeiramente por arredondamento fiscal, aceitar com tolerância de R$ 0.10
        val finalTotal = if (declaredTotal > 0.0 && abs(declaredTotal - calculatedTotal) <= 0.10) {
            declaredTotal
        } else if (declaredTotal <= 0.0) {
            calculatedTotal
        } else {
            declaredTotal
        }

        return data.copy(
            accessKey = validKey,
            supermarket = data.supermarket.copy(name = validSupermarketName),
            items = sanitizedItems,
            totalPrice = finalTotal
        )
    }
}

