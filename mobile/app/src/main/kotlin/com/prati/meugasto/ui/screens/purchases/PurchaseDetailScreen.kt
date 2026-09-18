package com.prati.meugasto.ui.screens.purchases

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocalGasStation
import androidx.compose.material.icons.filled.LocalPharmacy
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.repository.PurchaseRepository
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.DateFormatters
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.components.TopBarAction
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PurchaseDetailScreen(
    purchaseId: Long,
    repository: PurchaseRepository,
    onNavigateBack: () -> Unit
) {
    val purchases by repository.getPurchases().collectAsState(initial = emptyList())
    val purchase = purchases.firstOrNull { it.id == purchaseId }
    val coroutineScope = rememberCoroutineScope()
    var showDeleteConfirm by remember { mutableStateOf(false) }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Excluir compra?") },
            text = { Text("Esta ação removerá a compra e todos os seus itens definitivamente.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        coroutineScope.launch {
                            repository.deletePurchase(purchaseId)
                            showDeleteConfirm = false
                            onNavigateBack()
                        }
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Excluir")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Detalhes da Compra",
                navigationIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onNavigateBack = onNavigateBack,
                actions = listOf(
                    TopBarAction(
                        icon = Icons.Default.Delete,
                        contentDescription = "Excluir compra",
                        onClick = { showDeleteConfirm = true }
                    )
                )
            )
        }
    ) { padding ->
        if (purchase == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = AppSpacing.LG),
                verticalArrangement = Arrangement.spacedBy(AppSpacing.MD)
            ) {
                item {
                    Spacer(modifier = Modifier.height(AppSpacing.XS))
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = AppShapes.Large,
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        val (establishmentIcon, _) = when (purchase.supermarket.type) {
                            com.prati.meugasto.domain.model.EstablishmentType.PHARMACY -> Icons.Default.LocalPharmacy to "Farmácia"
                            com.prati.meugasto.domain.model.EstablishmentType.GAS_STATION -> Icons.Default.LocalGasStation to "Posto de Combustível"
                            com.prati.meugasto.domain.model.EstablishmentType.SUPERMARKET -> Icons.Default.ShoppingCart to "Supermercado"
                            com.prati.meugasto.domain.model.EstablishmentType.OTHER -> Icons.Default.Storefront to "Outro"
                        }
                        Column(modifier = Modifier.padding(AppSpacing.XL)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                            ) {
                                Icon(
                                    imageVector = establishmentIcon,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Text(
                                    text = purchase.supermarket.name,
                                    style = MaterialTheme.typography.titleLarge,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                    modifier = Modifier.weight(1f)
                                )
                                Surface(
                                    shape = AppShapes.Full,
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                ) {
                                    Text(
                                        text = purchase.supermarket.type.displayName,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        modifier = Modifier.padding(horizontal = AppSpacing.SM, vertical = AppSpacing.XS)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(AppSpacing.XS))
                            Text(
                                text = DateFormatters.friendly(purchase.date),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            if (!purchase.supermarket.cnpj.isNullOrBlank()) {
                                Text(
                                    text = "CNPJ: ${purchase.supermarket.cnpj}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                            Spacer(modifier = Modifier.height(AppSpacing.LG))

                            val itemsSum = remember(purchase.products) { purchase.products.sumOf { it.price } }
                            val discount = remember(itemsSum, purchase.totalPrice) {
                                (itemsSum - purchase.totalPrice).coerceAtLeast(0.0)
                            }

                            if (discount > 0.05) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "Subtotal",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f)
                                    )
                                    MoneyText(
                                        value = itemsSum,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f)
                                    )
                                }
                                Spacer(modifier = Modifier.height(AppSpacing.XS))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = "Descontos",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f)
                                    )
                                    val formattedDiscount = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("pt", "BR")).format(discount)
                                    Text(
                                        text = "- $formattedDiscount",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f)
                                    )
                                }
                                HorizontalDivider(
                                    modifier = Modifier.padding(vertical = AppSpacing.SM),
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f)
                                )
                            }

                            Text(
                                text = "Total Pago",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            MoneyText(
                                value = purchase.totalPrice,
                                style = MaterialTheme.typography.headlineMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }

                item {
                    Text(
                        text = "Itens (${purchase.products.size})",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(top = AppSpacing.SM)
                    )
                }

                items(purchase.products) { item ->
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
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.name,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = "${item.quantity} ${item.unit}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            MoneyText(
                                value = item.price,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(AppSpacing.XL))
                }
            }
        }
    }
}

