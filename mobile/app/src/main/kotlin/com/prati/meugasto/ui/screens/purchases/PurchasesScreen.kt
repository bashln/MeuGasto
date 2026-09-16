package com.prati.meugasto.ui.screens.purchases

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.EmptyState
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.screens.dashboard.PurchaseListItem
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing

@Composable
fun PurchasesScreen(
    repository: PurchaseRepository,
    onNavigateToDetail: (Long) -> Unit
) {
    val purchases by repository.getPurchases().collectAsState(initial = emptyList())
    var searchQuery by remember { mutableStateOf("") }

    val filteredPurchases = remember(purchases, searchQuery) {
        if (searchQuery.isBlank()) purchases
        else purchases.filter {
            it.supermarket.name.contains(searchQuery, ignoreCase = true) ||
            it.products.any { item -> item.name.contains(searchQuery, ignoreCase = true) }
        }
    }

    val groupedPurchases = remember(filteredPurchases) {
        filteredPurchases.groupBy { it.date }.toSortedMap(compareByDescending { it })
    }

    val totalCount = filteredPurchases.size
    val totalSpent = filteredPurchases.sumOf { it.totalPrice }

    Scaffold(
        topBar = {
            AppTopBar(title = "Minhas Compras")
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = AppSpacing.LG)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Buscar por mercado ou produto...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = AppShapes.Small
            )

            if (filteredPurchases.isNotEmpty()) {
                Spacer(modifier = Modifier.height(AppSpacing.SM))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "$totalCount compras",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    MoneyText(
                        value = totalSpent,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.LG))

            if (filteredPurchases.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.ShoppingCart,
                    title = if (searchQuery.isBlank()) "Nenhuma compra registrada" else "Nenhum resultado encontrado",
                    description = if (searchQuery.isBlank()) "Escaneie uma nota fiscal para começar" else "Tente outro termo de busca"
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    groupedPurchases.forEach { (date, dayPurchases) ->
                        item {
                            Text(
                                text = formatDateHeader(date),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = AppSpacing.XS)
                            )
                        }
                        items(dayPurchases) { purchase ->
                            PurchaseListItem(
                                purchase = purchase,
                                onClick = { onNavigateToDetail(purchase.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun formatDateHeader(date: String): String {
    return try {
        val parts = date.split("-")
        if (parts.size >= 3) {
            val day = parts[2].toInt()
            val month = parts[1].toInt()
            val year = parts[0].toInt()
            val monthNames = listOf(
                "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
            )
            "$day de ${monthNames[month - 1]} de $year"
        } else date
    } catch (_: Exception) { date }
}
