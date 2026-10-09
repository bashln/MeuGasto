package com.prati.meugasto.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector? = null) {
    object Dashboard : Screen("dashboard", "Início", Icons.Default.Home)
    object Purchases : Screen("purchases", "Compras", Icons.Default.ShoppingCart)
    object Scanner : Screen("scanner", "Escanear", Icons.Default.QrCodeScanner)
    object Planning : Screen("planning", "Listas", Icons.Default.Checklist)
    object Reports : Screen("reports", "Relatórios", Icons.Default.BarChart)
    object Settings : Screen("settings", "Ajustes")
    object Onboarding : Screen("onboarding", "Boas-vindas")
    object ProductHistory : Screen("product_history/{productName}", "Histórico do Produto")
    object PriceComparison : Screen("price_comparison", "Comparador de Preços")
    object Profile : Screen("profile", "Perfil", Icons.Default.Person)
    object Login : Screen("login", "Entrar")
}

val BottomNavItems = listOf(
    Screen.Dashboard,
    Screen.Purchases,
    Screen.Reports,
    Screen.Profile
)
