package com.prati.meugasto

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.prati.meugasto.ui.navigation.BottomNavItems
import com.prati.meugasto.ui.navigation.Screen
import com.prati.meugasto.ui.screens.dashboard.DashboardScreen
import com.prati.meugasto.ui.screens.onboarding.OnboardingScreen
import com.prati.meugasto.ui.screens.planning.ShoppingListScreen
import com.prati.meugasto.ui.screens.purchases.PurchaseDetailScreen
import com.prati.meugasto.ui.screens.purchases.PurchasesScreen
import com.prati.meugasto.ui.screens.scanner.ScanQrCodeScreen
import com.prati.meugasto.ui.screens.settings.SettingsScreen
import com.prati.meugasto.ui.theme.MeuGastoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val app = application as MeuGastoApp
        val preferences = app.preferences
        val repository = app.purchaseRepository
        val database = app.database

        setContent {
            MeuGastoTheme {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                val isOnboardingCompleted = remember { preferences.isOnboardingCompleted() }
                val startDestination = if (isOnboardingCompleted) Screen.Dashboard.route else Screen.Onboarding.route

                val shouldShowBottomBar = currentDestination?.route in BottomNavItems.map { it.route }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        if (shouldShowBottomBar) {
                            NavigationBar {
                                BottomNavItems.forEach { screen ->
                                    NavigationBarItem(
                                        icon = { screen.icon?.let { Icon(it, contentDescription = screen.title) } },
                                        label = { Text(screen.title) },
                                        selected = currentDestination?.route == screen.route,
                                        onClick = {
                                            navController.navigate(screen.route) {
                                                popUpTo(navController.graph.findStartDestination().id) {
                                                    saveState = true
                                                }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = startDestination,
                        modifier = Modifier.padding(if (shouldShowBottomBar) innerPadding else androidx.compose.foundation.layout.PaddingValues())
                    ) {
                        composable(Screen.Onboarding.route) {
                            OnboardingScreen(
                                preferences = preferences,
                                onFinish = {
                                    navController.navigate(Screen.Dashboard.route) {
                                        popUpTo(Screen.Onboarding.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        composable(Screen.Dashboard.route) {
                            DashboardScreen(
                                repository = repository,
                                onNavigateToScanner = { navController.navigate(Screen.Scanner.route) },
                                onNavigateToPurchaseDetail = { purchaseId ->
                                    navController.navigate("purchase_detail/$purchaseId")
                                }
                            )
                        }

                        composable(Screen.Purchases.route) {
                            PurchasesScreen(
                                repository = repository,
                                onNavigateToDetail = { purchaseId ->
                                    navController.navigate("purchase_detail/$purchaseId")
                                }
                            )
                        }

                        composable(Screen.Scanner.route) {
                            ScanQrCodeScreen(
                                repository = repository,
                                onNavigateBack = { navController.popBackStack() },
                                onPurchaseCreated = { purchaseId ->
                                    navController.navigate("purchase_detail/$purchaseId") {
                                        popUpTo(Screen.Scanner.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        composable(Screen.Planning.route) {
                            ShoppingListScreen(database = database)
                        }

                        composable(Screen.Reports.route) {
                            SettingsScreen(preferences = preferences)
                        }

                        composable(Screen.Settings.route) {
                            SettingsScreen(preferences = preferences)
                        }

                        composable("purchase_detail/{purchaseId}") { backStackEntry ->
                            val purchaseId = backStackEntry.arguments?.getString("purchaseId")?.toLongOrNull() ?: 0L
                            PurchaseDetailScreen(
                                purchaseId = purchaseId,
                                repository = repository,
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }
}

