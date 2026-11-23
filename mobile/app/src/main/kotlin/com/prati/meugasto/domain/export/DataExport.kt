package com.prati.meugasto.domain.export

import com.prati.meugasto.domain.model.Draft
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.domain.model.ShoppingList
import com.prati.meugasto.domain.model.Supermarket
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Versão do formato do arquivo de exportação. Incremente ao mudar o schema. */
const val DATA_EXPORT_SCHEMA_VERSION = 1

/**
 * Contrato público do arquivo de exportação (LGPD art. 18, II e V).
 *
 * As DTOs são intencionalmente separadas dos modelos de domínio: campos de
 * credencial, ids de servidor e referências de conta não existem neste tipo,
 * então não há como vazarem por engano ao serializar.
 */
@Serializable
data class DataExportDocument(
    val schemaVersion: Int = DATA_EXPORT_SCHEMA_VERSION,
    val exportedAt: String,
    val appVersion: String? = null,
    val profile: DataExportProfile? = null,
    val supermarkets: List<ExportSupermarket> = emptyList(),
    val purchases: List<ExportPurchase> = emptyList(),
    val shoppingLists: List<ExportShoppingList> = emptyList(),
    val drafts: List<ExportDraft> = emptyList()
)

@Serializable
data class DataExportProfile(
    val email: String? = null,
    val appMode: String
)

@Serializable
data class ExportSupermarket(
    val id: Long,
    val name: String,
    val cnpj: String? = null,
    val city: String? = null,
    val state: String? = null,
    val type: String,
    val isManual: Boolean,
    val createdAt: String? = null
)

@Serializable
data class ExportPurchase(
    val id: Long,
    val supermarketId: Long,
    val supermarketName: String,
    val date: String,
    val totalPrice: Double,
    val isManual: Boolean,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val items: List<ExportItem> = emptyList()
)

@Serializable
data class ExportItem(
    val name: String,
    val code: String? = null,
    val categoryId: Int? = null,
    val quantity: Double,
    val unit: String,
    val price: Double
)

@Serializable
data class ExportShoppingList(
    val id: Long,
    val name: String,
    val status: String,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val items: List<ExportShoppingListItem> = emptyList()
)

@Serializable
data class ExportShoppingListItem(
    val name: String,
    val quantity: Double,
    val unit: String,
    val estimatedPrice: Double,
    val createdAt: String? = null
)

@Serializable
data class ExportDraft(
    val id: Long,
    val supermarketId: Long? = null,
    val supermarketName: String? = null,
    val content: String,
    val totalPrice: Double,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val items: List<ExportDraftItem> = emptyList()
)

@Serializable
data class ExportDraftItem(
    val name: String,
    val quantity: Double,
    val unit: String,
    val price: Double
)

private val exportJson = Json {
    prettyPrint = true
    encodeDefaults = true
}

/** Serializa o retrato completo dos dados do titular em JSON legível. */
fun buildDataExport(
    exportedAt: String,
    appVersion: String?,
    profile: DataExportProfile?,
    supermarkets: List<Supermarket>,
    purchases: List<Purchase>,
    shoppingLists: List<ShoppingList>,
    drafts: List<Draft>
): String {
    val document = DataExportDocument(
        exportedAt = exportedAt,
        appVersion = appVersion,
        profile = profile,
        supermarkets = supermarkets.map { it.toExportSupermarket() },
        purchases = purchases.map { it.toExportPurchase() },
        shoppingLists = shoppingLists.map { it.toExportShoppingList() },
        drafts = drafts.map { it.toExportDraft() }
    )
    return exportJson.encodeToString(DataExportDocument.serializer(), document)
}

private fun Supermarket.toExportSupermarket() = ExportSupermarket(
    id = id,
    name = name,
    cnpj = cnpj,
    city = city,
    state = state,
    type = type.name,
    isManual = isManual,
    createdAt = createdAt
)

private fun Purchase.toExportPurchase() = ExportPurchase(
    id = id,
    supermarketId = supermarket.id,
    supermarketName = supermarket.name,
    date = date,
    totalPrice = totalPrice,
    isManual = isManual,
    createdAt = createdAt,
    updatedAt = updatedAt,
    items = products.map { item ->
        ExportItem(
            name = item.name,
            code = item.code,
            categoryId = item.categoryId,
            quantity = item.quantity,
            unit = item.unit,
            price = item.price
        )
    }
)

private fun ShoppingList.toExportShoppingList() = ExportShoppingList(
    id = id,
    name = name,
    status = status,
    createdAt = createdAt,
    updatedAt = updatedAt,
    items = items.map { item ->
        ExportShoppingListItem(
            name = item.name,
            quantity = item.quantity,
            unit = item.unit,
            estimatedPrice = item.estimatedPrice,
            createdAt = item.createdAt
        )
    }
)

private fun Draft.toExportDraft() = ExportDraft(
    id = id,
    supermarketId = supermarket?.id,
    supermarketName = supermarket?.name,
    content = content,
    totalPrice = totalPrice,
    createdAt = createdAt,
    updatedAt = updatedAt,
    items = items.map { item ->
        ExportDraftItem(
            name = item.name,
            quantity = item.quantity,
            unit = item.unit,
            price = item.price
        )
    }
)
