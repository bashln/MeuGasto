package com.prati.meugasto.domain.export

import com.prati.meugasto.domain.model.Draft
import com.prati.meugasto.domain.model.DraftItem
import com.prati.meugasto.domain.model.Item
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.domain.model.ShoppingList
import com.prati.meugasto.domain.model.ShoppingListItem
import com.prati.meugasto.domain.model.Supermarket
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DataExportTest {

    private val market = Supermarket(
        id = 7,
        name = "Mercado Central",
        cnpj = "12345678000199",
        city = "Rio de Janeiro",
        state = "RJ",
        isManual = false,
        createdAt = "2026-01-10T09:00:00"
    )

    private val purchase = Purchase(
        id = 42,
        supermarket = market,
        date = "2026-01-11",
        totalPrice = 25.50,
        isManual = false,
        products = listOf(
            Item(id = 1, purchaseId = 42, name = "Arroz 5kg", quantity = 1.0, unit = "UN", price = 25.50)
        ),
        createdAt = "2026-01-11T18:00:00",
        updatedAt = "2026-01-11T18:05:00",
        accessKey = "35260112345678000199650010000001231000001234"
    )

    private val shoppingList = ShoppingList(
        id = 3,
        userId = "usuario-nao-deve-aparecer",
        name = "Compras da semana",
        status = "active",
        createdAt = "2026-01-12T08:00:00",
        updatedAt = "2026-01-12T08:10:00",
        items = listOf(
            ShoppingListItem(
                id = 9,
                shoppingListId = 3,
                name = "Feijão",
                quantity = 2.0,
                unit = "UN",
                estimatedPrice = 8.0,
                createdAt = "2026-01-12T08:00:00"
            )
        )
    )

    private val draft = Draft(
        id = 5,
        supermarket = market,
        content = "nota em processamento",
        items = listOf(DraftItem(name = "Café", quantity = 1.0, unit = "UN", price = 15.0)),
        totalPrice = 15.0,
        createdAt = "2026-01-13T07:00:00",
        updatedAt = "2026-01-13T07:01:00"
    )

    private fun export(
        purchases: List<Purchase> = listOf(purchase),
        lists: List<ShoppingList> = listOf(shoppingList),
        drafts: List<Draft> = listOf(draft)
    ) = buildDataExport(
        exportedAt = "2026-11-23T20:00:00-03:00",
        appVersion = "0.5.8.0",
        profile = DataExportProfile(email = "titular@example.com", appMode = "LOCAL_FIRST"),
        supermarkets = listOf(market),
        purchases = purchases,
        shoppingLists = lists,
        drafts = drafts
    )

    @Test
    fun `export carries every entity in a versioned document`() {
        val document = Json.parseToJsonElement(export()).jsonObject

        assertEquals(DATA_EXPORT_SCHEMA_VERSION, document.getValue("schemaVersion").jsonPrimitive.content.toInt())
        assertEquals("2026-11-23T20:00:00-03:00", document.getValue("exportedAt").jsonPrimitive.content)
        assertEquals("titular@example.com", document.getValue("profile").jsonObject.getValue("email").jsonPrimitive.content)
        assertEquals("Mercado Central", document.getValue("supermarkets").jsonArray.single().jsonObject.getValue("name").jsonPrimitive.content)

        val exportedPurchase = document.getValue("purchases").jsonArray.single().jsonObject
        assertEquals("2026-01-11", exportedPurchase.getValue("date").jsonPrimitive.content)
        assertEquals(
            "Arroz 5kg",
            exportedPurchase.getValue("items").jsonArray.single().jsonObject.getValue("name").jsonPrimitive.content
        )

        val exportedList = document.getValue("shoppingLists").jsonArray.single().jsonObject
        assertEquals("Compras da semana", exportedList.getValue("name").jsonPrimitive.content)
        assertEquals(1, exportedList.getValue("items").jsonArray.size)

        val exportedDraft = document.getValue("drafts").jsonArray.single().jsonObject
        assertEquals("nota em processamento", exportedDraft.getValue("content").jsonPrimitive.content)
        assertEquals("Café", exportedDraft.getValue("items").jsonArray.single().jsonObject.getValue("name").jsonPrimitive.content)
    }

    @Test
    fun `export never contains credential or account reference fields`() {
        val document = Json.parseToJsonElement(export())
        val forbiddenKeyParts = listOf("accesskey", "accesstoken", "token", "password", "secret", "hash", "userid", "remoteid")

        val keys = collectKeys(document)
        assertTrue(keys.isNotEmpty())
        for (key in keys) {
            for (forbidden in forbiddenKeyParts) {
                assertFalse("Campo proibido '$key' encontrado no export", key.lowercase().contains(forbidden))
            }
        }

        val raw = export()
        assertFalse(raw.contains(purchase.accessKey!!))
        assertFalse(raw.contains(shoppingList.userId!!))
    }

    @Test
    fun `export masks long digit sequences inside draft text`() {
        val key = "35260112345678000199650010000001231000001234"
        val draftWithKey = draft.copy(content = "payload bruto com $key e mais texto")

        val raw = export(drafts = listOf(draftWithKey))

        assertFalse(raw.contains(key))
        assertTrue(raw.contains("payload bruto com"))
    }

    @Test
    fun `export of an empty account still renders every collection`() {        val document = Json.parseToJsonElement(
            buildDataExport(
                exportedAt = "2026-11-23T20:00:00-03:00",
                appVersion = null,
                profile = null,
                supermarkets = emptyList(),
                purchases = emptyList(),
                shoppingLists = emptyList(),
                drafts = emptyList()
            )
        ).jsonObject

        assertEquals(DATA_EXPORT_SCHEMA_VERSION, document.getValue("schemaVersion").jsonPrimitive.content.toInt())
        for (collection in listOf("supermarkets", "purchases", "shoppingLists", "drafts")) {
            assertEquals(0, document.getValue(collection).jsonArray.size)
        }
    }

    @Test
    fun `export of ten thousand purchases stays under twenty megabytes`() {
        val item = Item(name = "Produto de mercado com nome tipico", quantity = 1.0, unit = "UN", price = 9.99)
        val purchases = (1..10_000).map { id ->
            purchase.copy(id = id.toLong(), products = List(5) { item })
        }

        val raw = export(purchases = purchases, lists = emptyList(), drafts = emptyList())

        assertTrue("Export grande demais: ${raw.length} caracteres", raw.length < 20_000_000)
    }

    private fun collectKeys(element: JsonElement): List<String> = when (element) {
        is JsonObject -> element.entries.flatMap { (key, value) -> listOf(key) + collectKeys(value) }
        is JsonArray -> element.flatMap { collectKeys(it) }
        is JsonPrimitive -> emptyList()
    }
}
