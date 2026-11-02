package com.prati.meugasto.data.local.database

import java.security.MessageDigest

internal object PurchaseAccessKeyHasher {
    data class Row(
        val id: Long,
        val accessKey: String?,
        val remoteId: Long?,
        val pendingCloudUserId: String?
    )

    data class BackfillAction(
        val id: Long,
        val accessKeyHash: String?,
        val clearPlaintextAccessKey: Boolean
    )

    fun normalizeAccessKey(raw: String?): String? =
        raw?.filterNot(Char::isWhitespace)?.takeIf { it.isNotEmpty() }

    fun sha256Hex(rawAccessKey: String?): String? {
        val normalized = normalizeAccessKey(rawAccessKey) ?: return null
        val digest = MessageDigest.getInstance("SHA-256").digest(normalized.toByteArray(Charsets.UTF_8))
        return buildString(digest.size * 2) {
            for (byte in digest) {
                append(((byte.toInt() ushr 4) and 0xF).toString(16))
                append((byte.toInt() and 0xF).toString(16))
            }
        }
    }

    fun planBackfill(rows: List<Row>): List<BackfillAction> {
        val seenHashes = HashSet<String>()
        return rows.sortedBy { it.id }.map { row ->
            val candidateHash = sha256Hex(row.accessKey)
            val uniqueHash = if (candidateHash != null && seenHashes.add(candidateHash)) {
                candidateHash
            } else {
                null
            }
            val needsTransientKeyForCloudUpload =
                row.pendingCloudUserId != null && row.remoteId == null
            BackfillAction(
                id = row.id,
                accessKeyHash = uniqueHash,
                clearPlaintextAccessKey = !needsTransientKeyForCloudUpload && row.accessKey != null
            )
        }
    }
}
