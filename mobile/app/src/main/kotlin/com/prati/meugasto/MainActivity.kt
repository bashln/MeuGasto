package com.prati.meugasto

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.prati.meugasto.ui.navigation.BottomNavItems
import com.prati.meugasto.ui.navigation.Screen
import com.prati.meugasto.ui.screens.dashboard.DashboardScreen
import com.prati.meugasto.ui.screens.onboarding.OnboardingScreen
import com.prati.meugasto.ui.screens.planning.ShoppingListScreen
import com.prati.meugasto.ui.screens.purchases.PurchaseDetailScreen
import com.prati.meugasto.ui.screens.purchases.PurchasesScreen
import com.prati.meugasto.ui.screens.reports.ProductHistoryScreen
import com.prati.meugasto.ui.screens.reports.ReportsScreen
import com.prati.meugasto.ui.screens.scanner.ScanQrCodeScreen
import com.prati.meugasto.ui.screens.settings.SettingsScreen
import com.prati.meugasto.ui.theme.MeuGastoTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val app = application as MeuGastoApp
        val preferences = app.preferences
        val repository = app.purchaseRepository
        val database = app.database
        val authRepository = app.authRepository
        val cloudSyncManager = app.cloudSyncManager

        setContent {
            val themeMode by preferences.themeMode.collectAsState()
            val isDark = when (themeMode) {
                com.prati.meugasto.data.local.preferences.ThemeMode.LIGHT -> false
                com.prati.meugasto.data.local.preferences.ThemeMode.DARK -> true
                com.prati.meugasto.data.local.preferences.ThemeMode.SYSTEM -> androidx.compose.foundation.isSystemInDarkTheme()
            }

            MeuGastoTheme(darkTheme = isDark) {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                val appScope = rememberCoroutineScope()

                // Sessão de nuvem restaurada: sincroniza as compras ao abrir o app.
                LaunchedEffect(Unit) {
                    if (authRepository.state.value is com.prati.meugasto.data.remote.supabase.AuthState.LoggedIn) {
                        cloudSyncManager.syncNow()
                    }
                }

                val isOnboardingCompleted = remember { preferences.isOnboardingCompleted() }
                val startDestination = if (isOnboardingCompleted) Screen.Dashboard.route else Screen.Onboarding.route

                val shouldShowBottomBar = currentDestination?.route in BottomNavItems.map { it.route }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        if (shouldShowBottomBar) {
                            NavigationBar(
                                containerColor = com.prati.meugasto.ui.theme.PrimaryBrand,
                                tonalElevation = 8.dp
                            ) {
                                BottomNavItems.forEach { screen ->
                                    val isSelected = currentDestination?.route == screen.route
                                    NavigationBarItem(
                                        icon = { screen.icon?.let { Icon(it, contentDescription = screen.title) } },
                                        label = {
                                            Text(
                                                screen.title,
                                                fontWeight = if (isSelected) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.Normal
                                            )
                                        },
                                        selected = isSelected,
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = androidx.compose.ui.graphics.Color.White,
                                            selectedTextColor = androidx.compose.ui.graphics.Color.White,
                                            indicatorColor = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.25f),
                                            unselectedIconColor = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.70f),
                                            unselectedTextColor = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.70f)
                                        ),
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
                    },
                    floatingActionButton = {
                        if (shouldShowBottomBar) {
                            FloatingActionButton(
                                onClick = { navController.navigate(Screen.Scanner.route) },
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = androidx.compose.ui.graphics.Color.White,
                                shape = androidx.compose.foundation.shape.CircleShape,
                                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.QrCodeScanner,
                                    contentDescription = "Escanear NFC-e"
                                )
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
                                },
                                onNavigateToPriceComparison = {
                                    navController.navigate(Screen.PriceComparison.route)
                                },
                                onNavigateToLists = {
                                    navController.navigate(Screen.Planning.route)
                                },
                                onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
                            )
                        }

                        composable(Screen.Purchases.route) {
                            PurchasesScreen(
                                repository = repository,
                                onNavigateToDetail = { purchaseId ->
                                    navController.navigate("purchase_detail/$purchaseId")
                                },
                                onNavigateToScanner = { navController.navigate(Screen.Scanner.route) }
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
                            ShoppingListScreen(
                                database = database,
                                onNavigateToComparison = {
                                    navController.navigate(Screen.PriceComparison.route)
                                }
                            )
                        }

                        composable(Screen.PriceComparison.route) {
                            com.prati.meugasto.ui.screens.planning.PriceComparisonScreen(
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }

                        composable(Screen.Reports.route) {
                            ReportsScreen(
                                repository = repository,
                                onNavigateToProductHistory = { productName ->
                                    navController.navigate("product_history/${java.net.URLEncoder.encode(productName, "UTF-8")}")
                                },
                                onScanReceipt = { navController.navigate(Screen.Scanner.route) }
                            )
                        }

                        composable("product_history/{productName}") { backStackEntry ->
                            val productName = java.net.URLDecoder.decode(
                                backStackEntry.arguments?.getString("productName") ?: "",
                                "UTF-8"
                            )
                            ProductHistoryScreen(
                                productName = productName,
                                repository = repository,
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }

                        composable(Screen.Settings.route) {
                            SettingsScreen(
                                preferences = preferences,
                                onNavigateBack = { navController.popBackStack() },
                                onNavigateToProfile = { navController.navigate(Screen.Profile.route) },
                                onNavigateToLogin = { navController.navigate(Screen.Login.route) },
                                onSignOut = { authRepository.signOut() }
                            )
                        }

                        composable(Screen.Login.route) {
                            com.prati.meugasto.ui.screens.auth.LoginScreen(
                                authRepository = authRepository,
                                onLoggedIn = {
                                    appScope.launch {
                                        cloudSyncManager.syncNow()
                                        navController.navigate(Screen.Dashboard.route) {
                                            popUpTo(Screen.Login.route) { inclusive = true }
                                        }
                                    }
                                },
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }

                        composable(Screen.Profile.route) {
                            com.prati.meugasto.ui.screens.profile.ProfileScreen(
                                preferences = preferences,
                                authRepository = authRepository,
                                onNavigateToLogin = { navController.navigate(Screen.Login.route) },
                                onNavigateBack = { navController.popBackStack() }
                            )
                        }

                        composable("purchase_detail/{purchaseId}") { backStackEntry ->
                            val purchaseId = backStackEntry.arguments?.getString("purchaseId")?.toLongOrNull() ?: 0L
                            PurchaseDetailScreen(
                                purchaseId = purchaseId,
                                repository = repository,
                                onNavigateBack = { navController.popBackStack() },
                                onNavigateToProductHistory = { productName ->
                                    navController.navigate("product_history/${java.net.URLEncoder.encode(productName, "UTF-8")}")
                                },
                                onNavigateToComparison = {
                                    navController.navigate(Screen.PriceComparison.route)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
