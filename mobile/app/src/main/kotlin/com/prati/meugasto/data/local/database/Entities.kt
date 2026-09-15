package com.prati.meugasto.data.local.database

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "supermarkets")
data class SupermarketEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val cnpj: String? = null,
    val city: String? = null,
    val state: String? = null,
    val isManual: Boolean = false,
    val createdAt: String
)

@Entity(
    tableName = "purchases",
    foreignKeys = [
        ForeignKey(
            entity = SupermarketEntity::class,
            parentColumns = ["id"],
            childColumns = ["supermarketId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["supermarketId"]), Index(value = ["date"])]
)
data class PurchaseEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val supermarketId: Long,
    val date: String,
    val totalPrice: Double,
    val isManual: Boolean = false,
    val createdAt: String,
    val updatedAt: String
)

@Entity(
    tableName = "items",
    foreignKeys = [
        ForeignKey(
            entity = PurchaseEntity::class,
            parentColumns = ["id"],
            childColumns = ["purchaseId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["purchaseId"])]
)
data class ItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val purchaseId: Long,
    val name: String,
    val code: String? = null,
    val categoryId: Int? = null,
    val quantity: Double,
    val unit: String,
    val price: Double
)

@Entity(tableName = "drafts")
data class DraftEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val supermarketId: Long? = null,
    val content: String,
    val itemsJson: String,
    val totalPrice: Double,
    val createdAt: String,
    val updatedAt: String
)

@Entity(tableName = "shopping_lists")
data class ShoppingListEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: String? = null,
    val name: String,
    val status: String = "active",
    val createdAt: String,
    val updatedAt: String
)

@Entity(
    tableName = "shopping_list_items",
    foreignKeys = [
        ForeignKey(
            entity = ShoppingListEntity::class,
            parentColumns = ["id"],
            childColumns = ["shoppingListId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["shoppingListId"])]
)
data class ShoppingListItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val shoppingListId: Long,
    val name: String,
    val quantity: Double,
    val unit: String,
    val estimatedPrice: Double,
    val createdAt: String
)

