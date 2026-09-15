package com.prati.meugasto.domain.model

import kotlinx.serialization.Serializable

enum class AppMode {
    CLOUD,      // Sincronizado com Supabase
    LOCAL_FIRST // 100% offline-first com sync em WebDAV/Drive/Dropbox
}

enum class SyncProviderType {
    WEBDAV,
    GOOGLE_DRIVE,
    DROPBOX
}

@Serializable
data class Supermarket(
    val id: Long = 0,
    val name: String,
    val cnpj: String? = null,
    val city: String? = null,
    val state: String? = null,
    val isManual: Boolean = false,
    val createdAt: String? = null
)

@Serializable
data class Item(
    val id: Long = 0,
    val purchaseId: Long = 0,
    val name: String,
    val code: String? = null,
    val categoryId: Int? = null,
    val quantity: Double,
    val unit: String,
    val price: Double
)

@Serializable
data class Purchase(
    val id: Long = 0,
    val supermarket: Supermarket,
    val date: String,
    val totalPrice: Double,
    val isManual: Boolean = false,
    val products: List<Item> = emptyList(),
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class DraftItem(
    val name: String,
    val quantity: Double,
    val unit: String,
    val price: Double
)

@Serializable
data class Draft(
    val id: Long = 0,
    val supermarket: Supermarket? = null,
    val content: String,
    val items: List<DraftItem> = emptyList(),
    val totalPrice: Double,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class ShoppingListItem(
    val id: Long = 0,
    val shoppingListId: Long = 0,
    val name: String,
    val quantity: Double,
    val unit: String,
    val estimatedPrice: Double,
    val createdAt: String? = null
)

@Serializable
data class ShoppingList(
    val id: Long = 0,
    val userId: String? = null,
    val name: String,
    val status: String = "active", // active, completed, archived
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val items: List<ShoppingListItem> = emptyList()
)

data class DashboardStats(
    val totalSpent: Double,
    val purchaseCount: Int,
    val itemCount: Int,
    val savings: Double
)

data class ComparisonMatch(
    val planned: ShoppingListItem,
    val real: Item,
    val quantityDiff: Double,
    val priceDiff: Double,
    val unitIncompatible: Boolean
)

data class ComparisonResult(
    val estimatedTotal: Double,
    val realTotal: Double,
    val economyOrLoss: Double,
    val matchedItems: List<ComparisonMatch>,
    val forgottenItems: List<ShoppingListItem>,
    val extraItems: List<Item>
)

