package com.prati.meugasto.ui.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationStructureTest {

    @Test
    fun testBottomNavItemsHasFourContentTabs() {
        assertEquals("Bottom nav must have exactly 4 main tabs", 4, BottomNavItems.size)
        assertTrue(BottomNavItems.contains(Screen.Dashboard))
        assertTrue(BottomNavItems.contains(Screen.Purchases))
        assertTrue(BottomNavItems.contains(Screen.Planning))
        assertTrue(BottomNavItems.contains(Screen.Reports))
    }

    @Test
    fun testScannerIsNotABottomNavTab() {
        assertFalse(
            "Scanner must be a primary action (FAB) rather than a bottom tab",
            BottomNavItems.contains(Screen.Scanner)
        )
    }

    @Test
    fun testAllScreenRoutesAreUnique() {
        val screens = listOf(
            Screen.Dashboard,
            Screen.Purchases,
            Screen.Scanner,
            Screen.Planning,
            Screen.Reports,
            Screen.Settings,
            Screen.Onboarding
        )
        val routes = screens.map { it.route }
        assertEquals(routes.size, routes.distinct().size)
    }
}
