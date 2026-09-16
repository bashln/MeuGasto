package com.prati.meugasto.ui.screens.reports

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.local.database.ProductStats
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.EmptyState
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.components.SectionHeader
import com.prati.meugasto.ui.components.charts.BarChartData
import com.prati.meugasto.ui.components.charts.LineChartData
import com.prati.meugasto.ui.components.charts.MarketSpendingChart
import com.prati.meugasto.ui.components.charts.SpendingTrendChart
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing

@Composable
fun ReportsScreen(
    repository: PurchaseRepository,
    onNavigateToProductHistory: (String) -> Unit = {}
) {
    val spendingByDate by repository.getSpendingByDate().collectAsState(initial = emptyList())
    val spendingByMarket by repository.getSpendingByMarket().collectAsState(initial = emptyList())
    val topProducts by repository.getTopProducts(10).collectAsState(initial = emptyList())

    val hasData = spendingByDate.isNotEmpty() || spendingByMarket.isNotEmpty()

    Scaffold(
        topBar = {
            AppTopBar(title = "Relatórios")
        }
    ) { padding ->
        if (!hasData) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = AppSpacing.LG)
            ) {
                EmptyState(
                    icon = Icons.Default.BarChart,
                    title = "Dados insuficientes",
                    description = "Registre algumas compras para ver seus relatórios de gastos e tendências."
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = AppSpacing.LG),
                verticalArrangement = Arrangement.spacedBy(AppSpacing.LG)
            ) {
                item {
                    Spacer(modifier = Modifier.height(AppSpacing.SM))
                }

                if (spendingByDate.isNotEmpty()) {
                    item {
                        SectionHeader(title = "Tendência de Gastos")
                    }

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
                                    text = "Gastos por data",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(AppSpacing.SM))
                                SpendingTrendChart(
                                    data = spendingByDate.map { (date, total) ->
                                        LineChartData(
                                            label = date.takeLast(5),
                                            value = total
                                        )
                                    }
                                )
                            }
                        }
                    }
                }

                if (spendingByMarket.isNotEmpty()) {
                    item {
                        SectionHeader(title = "Gastos por Mercado")
                    }

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
                                    text = "Distribuição por mercado",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(AppSpacing.SM))
                                MarketSpendingChart(
                                    data = spendingByMarket.map { (name, total) ->
                                        BarChartData(label = name, value = total)
                                    }
                                )
                                Spacer(modifier = Modifier.height(AppSpacing.MD))
                                spendingByMarket.forEach { (name, total) ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = AppSpacing.XS),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onSurface
                                        )
                                        MoneyText(
                                            value = total,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                if (topProducts.isNotEmpty()) {
                    item {
                        SectionHeader(title = "Produtos Mais Consumidos")
                    }

                    items(topProducts) { product ->
                        ProductStatItem(
                            product = product,
                            onClick = { onNavigateToProductHistory(product.name) }
                        )
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(AppSpacing.XL))
                }
            }
        }
    }
}

@Composable
fun ProductStatItem(
    product: ProductStats,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${product.totalQty.toInt()}x em ${product.purchaseCount} compras",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            MoneyText(
                value = product.totalSpent,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
