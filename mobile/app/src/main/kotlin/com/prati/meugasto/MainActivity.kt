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
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.ui.Alignment
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.prati.meugasto.ui.navigation.BottomNavItems
import com.prati.meugasto.ui.navigation.ScanActionPlacement
import com.prati.meugasto.ui.navigation.Screen
import com.prati.meugasto.data.remote.supabase.AuthState
import com.prati.meugasto.domain.model.AppMode
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
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)

        val app = application as MeuGastoApp
        val preferences = app.preferences
        val repository = app.purchaseRepository
        val database = app.database
        val authRepository = app.authRepository
        val cloudSyncManager = app.cloudSyncManager
        val cloudUploader = app.cloudUploader

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
                val snackbarHostState = remember { SnackbarHostState() }
                val coroutineScope = rememberCoroutineScope()
                val authState by authRepository.state.collectAsState()
                val appMode by preferences.appMode.collectAsState()
                var cloudCacheReady by remember { mutableStateOf(authState is AuthState.LoggedIn) }
                var cloudCacheError by remember { mutableStateOf<String?>(null) }

                LaunchedEffect(authState) {
                    if (authState is AuthState.LoggedOut) {
                        cloudCacheReady = false
                        cloudCacheError = null
                        runCatching { app.cloudPurchaseSync.clear() }
                            .onSuccess { cloudCacheReady = true }
                            .onFailure { cloudCacheError = it.message ?: "cache cleanup failed" }
                    } else {
                        cloudCacheReady = true
                        cloudCacheError = null
                    }
                }

                LaunchedEffect(authState, appMode) {
                    if (authState is AuthState.LoggedIn && appMode == AppMode.CLOUD) {
                        cloudSyncManager.syncNow().onFailure { error ->
                            snackbarHostState.showSnackbar(
                                "Não foi possível sincronizar: ${error.message ?: "verifique sua conexão"}"
                            )
                        }
                        cloudUploader.uploadPendingPurchases().onFailure { error ->
                            snackbarHostState.showSnackbar(
                                "Há compras aguardando envio: ${error.message ?: "verifique sua conexão"}"
                            )
                        }
                    }
                }

                if (!cloudCacheReady) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        if (cloudCacheError == null) {
                            CircularProgressIndicator()
                        } else {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Não foi possível proteger os dados da conta anterior.")
                                Button(onClick = {
                                    cloudCacheReady = false
                                    cloudCacheError = null
                                    coroutineScope.launch {
                                        runCatching { app.cloudPurchaseSync.clear() }
                                            .onSuccess { cloudCacheReady = true }
                                            .onFailure { cloudCacheError = it.message ?: "cache cleanup failed" }
                                    }
                                }) {
                                    Text("Tentar novamente")
                                }
                            }
                        }
                    }
                } else {
                val isOnboardingCompleted = remember { preferences.isOnboardingCompleted() }
                val startDestination = if (isOnboardingCompleted) Screen.Dashboard.route else Screen.Onboarding.route

                val activeBottomNavScreen = BottomNavItems.firstOrNull { it.route == currentDestination?.route }
                val shouldShowBottomBar = activeBottomNavScreen != null
                val shouldShowScanFab = activeBottomNavScreen?.scanActionPlacement == ScanActionPlacement.Floating

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
                    snackbarHost = { SnackbarHost(snackbarHostState) },
                    bottomBar = {
                        if (shouldShowBottomBar) {
                            NavigationBar(
                                containerColor = MaterialTheme.colorScheme.surface,
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
                                            selectedIconColor = MaterialTheme.colorScheme.primary,
                                            selectedTextColor = MaterialTheme.colorScheme.primary,
                                            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
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
                        if (shouldShowScanFab) {
                            FloatingActionButton(
                                onClick = { navController.navigate(Screen.Scanner.route) },
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary,
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
                                },
                                onPurchaseSaved = { purchaseId ->
                                    if (authRepository.state.value is AuthState.LoggedIn && appMode == AppMode.CLOUD) {
                                        cloudUploader.upload(purchaseId).onFailure { error ->
                                            snackbarHostState.showSnackbar(
                                                "Compra salva no aparelho, mas não sincronizada: ${error.message ?: "verifique sua conexão"}"
                                            )
                                        }
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
                                }
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
                                    // O sync é disparado pelo observador de authState no Scaffold.
                                    navController.navigate(Screen.Dashboard.route) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
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
                                appMode = appMode,
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
}
