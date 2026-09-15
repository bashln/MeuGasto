package com.prati.meugasto.ui.screens.purchases

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.ui.screens.dashboard.PurchaseListItem

@OptIn(ExperimentalMaterial3Api::class)
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Minhas Compras", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Buscar por mercado ou produto...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredPurchases) { purchase ->
                    PurchaseListItem(purchase = purchase, onClick = { onNavigateToDetail(purchase.id) })
                }
            }
        }
    }
}

