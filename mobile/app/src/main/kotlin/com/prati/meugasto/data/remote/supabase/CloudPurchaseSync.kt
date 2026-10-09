package com.prati.meugasto.data.remote.supabase

import androidx.room.withTransaction
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ItemEntity
import com.prati.meugasto.data.local.database.PurchaseEntity
import com.prati.meugasto.data.local.database.SupermarketEntity
import com.prati.meugasto.domain.model.EstablishmentDetector
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val UNKNOWN_MARKET = "Estabelecimento não informado"

/**
 * Espelha as compras do Supabase na Room. Idempotente: cada linha remota tem um
 * `remoteId` único, portanto sincronizar várias vezes não duplica dados.
 */
class CloudPurchaseSync(
    private val database: AppDatabase
) {

    suspend fun sync(remote: List<RemotePurchase>): Int {
        database.withTransaction {
            remote.forEach { purchase -> upsertPurchase(purchase) }
        }
        return remote.size
    }

    private suspend fun upsertPurchase(remote: RemotePurchase) {
        val supermarketId = upsertSupermarket(remote.supermarket)

        val total = if (remote.totalPrice > 0.0) {
            remote.totalPrice
        } else {
            remote.items.sumOf { it.price }
        }
        val now = nowIso()
        val createdAt = remote.createdAt ?: now
        val updatedAt = remote.updatedAt ?: now

        val purchaseDao = database.purchaseDao()
        val existingId = purchaseDao.findIdByRemoteId(remote.id)

        val purchaseId = if (existingId == null) {
            purchaseDao.insertPurchase(
                PurchaseEntity(
                    supermarketId = supermarketId,
                    date = remote.date,
                    totalPrice = total,
                    isManual = remote.manual,
                    createdAt = createdAt,
                    updatedAt = updatedAt,
                    remoteId = remote.id
                )
            )
        } else {
            purchaseDao.updateFromRemote(
                id = existingId,
                supermarketId = supermarketId,
                date = remote.date,
                totalPrice = total,
                isManual = remote.manual,
                updatedAt = updatedAt
            )
            existingId
        }

        purchaseDao.deleteItemsByPurchaseId(purchaseId)
        purchaseDao.insertItems(
            remote.items.map { item ->
                ItemEntity(
                    purchaseId = purchaseId,
                    name = item.name,
                    code = item.code,
                    categoryId = item.categoryId,
                    quantity = item.quantity,
                    unit = item.unit.orEmpty(),
                    price = item.price,
                    remoteId = item.id
                )
            }
        )
    }

    private suspend fun upsertSupermarket(remote: RemoteSupermarket?): Long {
        val supermarketDao = database.supermarketDao()
        if (remote == null) {
            return supermarketDao.findByName(UNKNOWN_MARKET)?.id
                ?: supermarketDao.insert(
                    SupermarketEntity(
                        name = UNKNOWN_MARKET,
                        createdAt = nowIso()
                    )
                )
        }

        val byRemoteId = supermarketDao.findIdByRemoteId(remote.id)
        if (byRemoteId != null) return byRemoteId

        val byName = supermarketDao.findByName(remote.name)
        if (byName != null) {
            supermarketDao.setRemoteId(byName.id, remote.id)
            return byName.id
        }

        return supermarketDao.insert(
            SupermarketEntity(
                name = remote.name,
                cnpj = remote.cnpj,
                city = remote.city,
                state = remote.state,
                type = EstablishmentDetector.detectType(remote.name).name,
                isManual = remote.manual,
                createdAt = nowIso(),
                remoteId = remote.id
            )
        )
    }

    private fun nowIso(): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())
}
