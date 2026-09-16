package com.prati.meugasto.ui.screens.reports

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.local.database.ProductPriceEntry
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.components.charts.LineChartData
import com.prati.meugasto.ui.components.charts.SpendingTrendChart
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductHistoryScreen(
    productName: String,
    repository: PurchaseRepository,
    onNavigateBack: () -> Unit
) {
    val priceHistory by repository.getProductPriceHistory(productName).collectAsState(initial = emptyList())

    val avgPrice = if (priceHistory.isNotEmpty()) priceHistory.map { it.price }.average() else 0.0
    val minPrice = priceHistory.minOfOrNull { it.price } ?: 0.0
    val maxPrice = priceHistory.maxOfOrNull { it.price } ?: 0.0
    val latestPrice = priceHistory.lastOrNull()?.price ?: 0.0

    val marketPrices = priceHistory.groupBy { it.supermarketName }
        .mapValues { (_, entries) -> entries.map { it.price }.average() }
        .toList()
        .sortedByDescending { it.second }

    Scaffold(
        topBar = {
            AppTopBar(
                title = productName,
                actions = listOf(
                    Icons.AutoMirrored.Filled.ArrowBack to onNavigateBack
                )
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
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(modifier = Modifier.padding(AppSpacing.LG)) {
                        Text(
                            text = "Preço Atual",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        MoneyText(
                            value = latestPrice,
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    StatCard(
                        label = "Média",
                        value = "R$ %.2f".format(avgPrice),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "Menor",
                        value = "R$ %.2f".format(minPrice),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "Maior",
                        value = "R$ %.2f".format(maxPrice),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (priceHistory.size > 1) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = AppShapes.Medium,
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Column(modifier = Modifier.padding(AppSpacing.LG)) {
                            Text(
                                text = "Evolução do Preço",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.SM))
                            SpendingTrendChart(
                                data = priceHistory.map { entry ->
                                    LineChartData(
                                        label = entry.date.takeLast(5),
                                        value = entry.price
                                    )
                                }
                            )
                        }
                    }
                }
            }

            if (marketPrices.isNotEmpty()) {
                item {
                    Text(
                        text = "Preço por Mercado",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                items(marketPrices) { (marketName, avgPriceValue) ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = AppShapes.Small,
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        ),
                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(AppSpacing.MD),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = marketName,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            MoneyText(
                                value = avgPriceValue,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }

            if (priceHistory.isEmpty()) {
                item {
                    Text(
                        text = "Nenhum histórico de preços disponível para este produto.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(AppSpacing.XL))
            }
        }
    }
}

@Composable
fun StatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = AppShapes.Small,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier.padding(AppSpacing.MD)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}
