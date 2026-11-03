package com.prati.meugasto.data.remote.supabase

import org.junit.Assert.assertEquals
import org.junit.Test

class CloudItemPriceTest {
    @Test
    fun `cloud unit price and local line total preserve weighted item amount`() {
        val unitPrice = CloudItemPrice.toCloudUnitPrice(lineTotal = 15.45, quantity = 0.344)

        assertEquals(44.91, unitPrice, 0.001)
        assertEquals(15.45, CloudItemPrice.toLocalLineTotal(unitPrice, 0.344), 0.001)
    }

    @Test
    fun `invalid remote quantity follows the single unit fallback`() {
        assertEquals(5.0, CloudItemPrice.toCloudUnitPrice(5.0, 0.0), 0.001)
        assertEquals(5.0, CloudItemPrice.toLocalLineTotal(5.0, 0.0), 0.001)
    }
}
