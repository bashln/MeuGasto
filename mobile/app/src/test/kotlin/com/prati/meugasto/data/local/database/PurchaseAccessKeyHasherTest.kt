package com.prati.meugasto.data.local.database

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PurchaseAccessKeyHasherTest {

    private val key = "4326 0993 0150 0600 0113 6510 4000 3070 4419 9999 9999"

    @Test
    fun `normalize removes every whitespace character`() {
        assertEquals(
            "43260993015006000113651040003070441999999999",
            PurchaseAccessKeyHasher.normalizeAccessKey(key)
        )
        assertNull(PurchaseAccessKeyHasher.normalizeAccessKey("   "))
        assertNull(PurchaseAccessKeyHasher.normalizeAccessKey(null))
    }

    @Test
    fun `sha256 matches known vector after normalization`() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            PurchaseAccessKeyHasher.sha256Hex(" a b c ")
        )
    }

    @Test
    fun `plan clears plaintext key once the purchase no longer needs cloud upload`() {
        val actions = PurchaseAccessKeyHasher.planBackfill(
            listOf(
                PurchaseAccessKeyHasher.Row(id = 1, accessKey = key, remoteId = 99, pendingCloudUserId = "u1"),
                PurchaseAccessKeyHasher.Row(id = 2, accessKey = key, remoteId = null, pendingCloudUserId = null)
            )
        )

        assertTrue(actions[0].clearPlaintextAccessKey)
        assertTrue(actions[1].clearPlaintextAccessKey)
        assertNull(actions[1].accessKeyHash)
    }

    @Test
    fun `plan keeps plaintext key only while a cloud upload still depends on it`() {
        val actions = PurchaseAccessKeyHasher.planBackfill(
            listOf(
                PurchaseAccessKeyHasher.Row(
                    id = 3,
                    accessKey = key,
                    remoteId = null,
                    pendingCloudUserId = "u1"
                )
            )
        )

        assertFalse(actions.single().clearPlaintextAccessKey)
        assertEquals(PurchaseAccessKeyHasher.sha256Hex(key), actions.single().accessKeyHash)
    }
}
