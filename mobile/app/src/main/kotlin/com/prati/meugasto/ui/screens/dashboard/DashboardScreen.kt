package com.prati.meugasto.ui.screens.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.DateFormatters
import com.prati.meugasto.ui.components.EmptyState
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.components.PeriodSelector
import com.prati.meugasto.ui.components.SectionHeader
import com.prati.meugasto.ui.components.TopBarAction
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import com.prati.meugasto.ui.theme.extendedColors
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.abs

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

    val currentMonthPurchases = remember(allPurchases) { filterByMonthOffset(allPurchases, 0) }
    val previousMonthPurchases = remember(allPurchases) { filterByMonthOffset(allPurchases, 1) }

    val filteredPurchases = remember(allPurchases, selectedPeriod) {
        when (selectedPeriod) {
            "Mês Atual" -> currentMonthPurchases
            "Mês Anterior" -> previousMonthPurchases
            else -> allPurchases
        }
    }

    val periodTotal = filteredPurchases.sumOf { it.totalPrice }
    val periodCount = filteredPurchases.size
    val periodItems = filteredPurchases.sumOf { it.products.size }
    val uniqueMarkets = filteredPurchases.map { it.supermarket.name }.distinct().size
    val avgPurchase = if (periodCount > 0) periodTotal / periodCount else 0.0

    // Tendência do mês atual vs mês anterior: (gastouMais, rótulo)
    val trendBadge = remember(currentMonthPurchases, previousMonthPurchases, selectedPeriod) {
        if (selectedPeriod != "Mês Atual" || previousMonthPurchases.isEmpty()) {
            null
        } else {
            val currentTotal = currentMonthPurchases.sumOf { it.totalPrice }
            val previousTotal = previousMonthPurchases.sumOf { it.totalPrice }
            if (previousTotal <= 0.0) {
                null
            } else {
                val deltaPct = (currentTotal - previousTotal) / previousTotal * 100
                when {
                    abs(deltaPct) < 0.5 -> false to "Estável vs mês anterior"
                    deltaPct > 0 -> true to "+%.0f%% vs mês anterior".format(deltaPct)
                    else -> false to "−%.0f%% vs mês anterior".format(abs(deltaPct))
                }
            }
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "MeuGasto",
                actions = listOf(
                    TopBarAction(
                        icon = Icons.Default.Settings,
                        contentDescription = "Ajustes",
                        onClick = onNavigateToSettings
                    )
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
                        containerColor = MaterialTheme.colorScheme.primary
                    ),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                ) {
                    Column(modifier = Modifier.padding(AppSpacing.XL)) {
                        Text(
                            text = "Total Gasto",
                            style = MaterialTheme.typography.labelLarge,
                            color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.85f)
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.SM))
                        MoneyText(
                            value = periodTotal,
                            style = MaterialTheme.typography.headlineLarge,
                            color = androidx.compose.ui.graphics.Color.White
                        )
                        trendBadge?.let { (spentMore, label) ->
                            Spacer(modifier = Modifier.height(AppSpacing.SM))
                            Surface(
                                shape = AppShapes.Full,
                                color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.22f)
                            ) {
                                Row(
                                    modifier = Modifier.padding(
                                        horizontal = AppSpacing.MD,
                                        vertical = AppSpacing.XS
                                    ),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.XS)
                                ) {
                                    Icon(
                                        imageVector = if (spentMore) Icons.Default.TrendingUp else Icons.Default.TrendingDown,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp),
                                        tint = androidx.compose.ui.graphics.Color.White
                                    )
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
                                        color = androidx.compose.ui.graphics.Color.White
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(AppSpacing.LG))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "$periodCount compras",
                                style = MaterialTheme.typography.bodyMedium,
                                color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.85f)
                            )
                            Text(
                                text = "$periodItems itens",
                                style = MaterialTheme.typography.bodyMedium,
                                color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.85f)
                            )
                        }
                    }
                }
            }

            item {
                val avgPurchaseFormatted = remember(avgPurchase) {
                    NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(avgPurchase)
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    QuickMetricCard(
                        label = "Ticket Médio",
                        value = avgPurchaseFormatted,
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
                    text = "${DateFormatters.friendly(purchase.date)} • ${purchase.products.size} itens",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            MoneyText(
                value = purchase.totalPrice,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

/** Filtra compras de um mês relativo ao atual (0 = atual, 1 = anterior). */
private fun filterByMonthOffset(purchases: List<Purchase>, monthsAgo: Int): List<Purchase> {
    val cal = Calendar.getInstance()
    cal.add(Calendar.MONTH, -monthsAgo)
    val month = cal.get(Calendar.MONTH)
    val year = cal.get(Calendar.YEAR)
    return purchases.filter { purchase ->
        try {
            val parts = purchase.date.split("-")
            parts.size >= 3 && parts[1].toInt() - 1 == month && parts[0].toInt() == year
        } catch (_: Exception) {
            false
        }
    }
}
