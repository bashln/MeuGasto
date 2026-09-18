package com.prati.meugasto.ui.screens.purchases

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.domain.model.EstablishmentType
import com.prati.meugasto.domain.model.Purchase
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.DateFormatters
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
    var selectedTypeFilter by remember { mutableStateOf<EstablishmentType?>(null) }

    val filteredPurchases = remember(purchases, searchQuery, selectedTypeFilter) {
        purchases.filter { purchase ->
            val matchesType = selectedTypeFilter == null || purchase.supermarket.type == selectedTypeFilter
            val matchesQuery = searchQuery.isBlank() ||
                purchase.supermarket.name.contains(searchQuery, ignoreCase = true) ||
                purchase.products.any { item -> item.name.contains(searchQuery, ignoreCase = true) }
            matchesType && matchesQuery
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
            Spacer(modifier = Modifier.height(AppSpacing.MD))
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Buscar por estabelecimento ou produto...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Limpar")
                        }
                    }
                },
                singleLine = true,
                shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant
                )
            )

            Spacer(modifier = Modifier.height(AppSpacing.SM))

            // Chips de filtro por tipo de estabelecimento
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = AppSpacing.XS),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.XS)
            ) {
                FilterChip(
                    selected = selectedTypeFilter == null,
                    onClick = { selectedTypeFilter = null },
                    label = { Text("Todos") }
                )
                FilterChip(
                    selected = selectedTypeFilter == EstablishmentType.SUPERMARKET,
                    onClick = {
                        selectedTypeFilter = if (selectedTypeFilter == EstablishmentType.SUPERMARKET) null else EstablishmentType.SUPERMARKET
                    },
                    label = { Text("Mercados") }
                )
                FilterChip(
                    selected = selectedTypeFilter == EstablishmentType.PHARMACY,
                    onClick = {
                        selectedTypeFilter = if (selectedTypeFilter == EstablishmentType.PHARMACY) null else EstablishmentType.PHARMACY
                    },
                    label = { Text("Farmácias") }
                )
                FilterChip(
                    selected = selectedTypeFilter == EstablishmentType.GAS_STATION,
                    onClick = {
                        selectedTypeFilter = if (selectedTypeFilter == EstablishmentType.GAS_STATION) null else EstablishmentType.GAS_STATION
                    },
                    label = { Text("Postos") }
                )
            }

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
                                text = DateFormatters.longLabel(date),
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
