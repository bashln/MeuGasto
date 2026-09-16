package com.prati.meugasto.ui.screens.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.EmptyState
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.components.PeriodSelector
import com.prati.meugasto.ui.components.SectionHeader
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import com.prati.meugasto.ui.theme.Primary
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun DashboardScreen(
    repository: PurchaseRepository,
    onNavigateToScanner: () -> Unit,
    onNavigateToPurchaseDetail: (Long) -> Unit,
    onNavigateToSettings: () -> Unit = {}
) {
    val allPurchases by repository.getPurchases().collectAsState(initial = emptyList())
    val stats by repository.getDashboardStats().collectAsState(
        initial = com.prati.meugasto.domain.model.DashboardStats(0.0, 0, 0, 0.0)
    )

    val periods = listOf("Mês Atual", "Mês Anterior", "Todos")
    var selectedPeriod by remember { mutableStateOf(periods[0]) }

    val filteredPurchases = remember(allPurchases, selectedPeriod) {
        when (selectedPeriod) {
            "Mês Atual" -> {
                val cal = Calendar.getInstance()
                val month = cal.get(Calendar.MONTH)
                val year = cal.get(Calendar.YEAR)
                allPurchases.filter { purchase ->
                    try {
                        val parts = purchase.date.split("-")
                        parts.size >= 3 && parts[1].toInt() - 1 == month && parts[0].toInt() == year
                    } catch (_: Exception) { false }
                }
            }
            "Mês Anterior" -> {
                val cal = Calendar.getInstance()
                cal.add(Calendar.MONTH, -1)
                val month = cal.get(Calendar.MONTH)
                val year = cal.get(Calendar.YEAR)
                allPurchases.filter { purchase ->
                    try {
                        val parts = purchase.date.split("-")
                        parts.size >= 3 && parts[1].toInt() - 1 == month && parts[0].toInt() == year
                    } catch (_: Exception) { false }
                }
            }
            else -> allPurchases
        }
    }

    val periodTotal = filteredPurchases.sumOf { it.totalPrice }
    val periodCount = filteredPurchases.size
    val periodItems = filteredPurchases.sumOf { it.products.size }
    val uniqueMarkets = filteredPurchases.map { it.supermarket.name }.distinct().size
    val avgPurchase = if (periodCount > 0) periodTotal / periodCount else 0.0

    Scaffold(
        topBar = {
            AppTopBar(
                title = "MeuGasto",
                actions = listOf(
                    Icons.Default.Settings to onNavigateToSettings
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToScanner,
                icon = { Icon(Icons.Default.QrCodeScanner, contentDescription = null) },
                text = { Text("Escanear NFC-e") },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = AppSpacing.LG),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.LG)
        ) {
            item {
                Spacer(modifier = Modifier.height(AppSpacing.SM))
                PeriodSelector(
                    selectedPeriod = selectedPeriod,
                    periods = periods,
                    onPeriodSelected = { selectedPeriod = it }
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Large,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(modifier = Modifier.padding(AppSpacing.XL)) {
                        Text(
                            text = "Total Gasto",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.SM))
                        MoneyText(
                            value = periodTotal,
                            style = MaterialTheme.typography.headlineLarge,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.LG))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "$periodCount compras",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Text(
                                text = "$periodItems itens",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    QuickMetricCard(
                        label = "Ticket Médio",
                        value = "R$ %.2f".format(avgPurchase),
                        modifier = Modifier.weight(1f)
                    )
                    QuickMetricCard(
                        label = "Mercados",
                        value = "$uniqueMarkets",
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item {
                SectionHeader(title = "Últimas Compras")
            }

            if (filteredPurchases.isEmpty()) {
                item {
                    EmptyState(
                        icon = Icons.Default.ShoppingCart,
                        title = "Nenhuma compra neste período",
                        description = "Escaneie o QR Code de uma nota fiscal para começar!"
                    )
                }
            } else {
                items(filteredPurchases) { purchase ->
                    PurchaseListItem(
                        purchase = purchase,
                        onClick = { onNavigateToPurchaseDetail(purchase.id) }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }
}

@Composable
fun QuickMetricCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = AppShapes.Medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(AppSpacing.LG)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(AppSpacing.XS))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
fun PurchaseListItem(purchase: Purchase, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = AppShapes.Medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppSpacing.LG),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = purchase.supermarket.name,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(AppSpacing.XS))
                Text(
                    text = "${purchase.date} • ${purchase.products.size} itens",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            MoneyText(
                value = purchase.totalPrice,
                style = MaterialTheme.typography.titleMedium,
                color = Primary
            )
        }
    }
}
