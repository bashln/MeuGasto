package com.prati.meugasto.domain.nfce

import kotlinx.serialization.Serializable

@Serializable
data class NfceScrapedItem(
    val name: String,
    val code: String? = null,
    val quantity: Double,
    val unit: String,
    val price: Double
)

@Serializable
data class NfceScrapedData(
    val accessKey: String,
    val supermarket: NfceSupermarketInfo,
    val items: List<NfceScrapedItem>,
    val totalPrice: Double,
    val date: String
)

@Serializable
data class NfceSupermarketInfo(
    val name: String,
    val cnpj: String? = null,
    val city: String? = null,
    val state: String? = null
)

