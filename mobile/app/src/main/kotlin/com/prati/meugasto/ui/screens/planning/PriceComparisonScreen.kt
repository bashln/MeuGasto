package com.prati.meugasto.ui.screens.planning

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CompareArrows
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.prati.meugasto.domain.comparator.ComparisonCandidate
import com.prati.meugasto.domain.comparator.ItemComparisonResult
import com.prati.meugasto.domain.comparator.PriceComparator
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PriceComparisonScreen(
    onNavigateBack: () -> Unit = {}
) {
    var name1 by remember { mutableStateOf("Item 1") }
    var price1Str by remember { mutableStateOf("10,00") }
    var qty1Str by remember { mutableStateOf("500") }
    var unit1 by remember { mutableStateOf("g") }

    var name2 by remember { mutableStateOf("Item 2") }
    var price2Str by remember { mutableStateOf("20,00") }
    var qty2Str by remember { mutableStateOf("1.2") }
    var unit2 by remember { mutableStateOf("kg") }

    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("pt", "BR")) }

    val comparisonResult: ItemComparisonResult? = remember(name1, price1Str, qty1Str, unit1, name2, price2Str, qty2Str, unit2) {
        val p1 = price1Str.replace(",", ".").toDoubleOrNull() ?: 0.0
        val q1 = qty1Str.replace(",", ".").toDoubleOrNull() ?: 0.0
        val p2 = price2Str.replace(",", ".").toDoubleOrNull() ?: 0.0
        val q2 = qty2Str.replace(",", ".").toDoubleOrNull() ?: 0.0

        if (p1 > 0.0 && q1 > 0.0 && p2 > 0.0 && q2 > 0.0) {
            val cand1 = ComparisonCandidate(name1.ifBlank { "Item 1" }, p1, q1, unit1)
            val cand2 = ComparisonCandidate(name2.ifBlank { "Item 2" }, p2, q2, unit2)
            PriceComparator.compare(cand1, cand2)
        } else {
            null
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Comparador de Preços",
                navigationIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onNavigateBack = onNavigateBack
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(AppSpacing.LG),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.LG)
        ) {
            Text(
                text = "Compare preços sem salvar no histórico",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "Compare o custo real por unidade de medida para descobrir qual opção compensa mais.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
            ) {
                OutlinedButton(
                    onClick = {
                        name1 = "Item 1"
                        price1Str = ""
                        qty1Str = ""
                        unit1 = "un"
                        name2 = "Item 2"
                        price2Str = ""
                        qty2Str = ""
                        unit2 = "un"
                    },
                    modifier = Modifier.weight(1f),
                    shape = AppShapes.Small
                ) {
                    Text("🧹 Limpar Tudo")
                }
            }

            // Card Item 1
            ItemInputCard(
                title = "Opção 1",
                name = name1,
                onNameChange = { name1 = it },
                priceStr = price1Str,
                onPriceChange = { price1Str = it },
                qtyStr = qty1Str,
                onQtyChange = { qty1Str = it },
                selectedUnit = unit1,
                onUnitChange = { unit1 = it },
                isWinner = comparisonResult?.cheaperIndex == 1
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f))
                Surface(
                    shape = AppShapes.Full,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.padding(horizontal = AppSpacing.MD)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = AppSpacing.MD, vertical = AppSpacing.XS),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.XS)
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.CompareArrows,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "VERSUS",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
                HorizontalDivider(modifier = Modifier.weight(1f))
            }

            // Card Item 2
            ItemInputCard(
                title = "Opção 2",
                name = name2,
                onNameChange = { name2 = it },
                priceStr = price2Str,
                onPriceChange = { price2Str = it },
                qtyStr = qty2Str,
                onQtyChange = { qty2Str = it },
                selectedUnit = unit2,
                onUnitChange = { unit2 = it },
                isWinner = comparisonResult?.cheaperIndex == 2
            )

            // Resultado da Comparação
            if (comparisonResult != null) {
                if (comparisonResult.isComparable) {
                    val winnerName = when (comparisonResult.cheaperIndex) {
                        1 -> name1.ifBlank { "Opção 1" }
                        2 -> name2.ifBlank { "Opção 2" }
                        else -> null
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = AppShapes.Medium,
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Column(modifier = Modifier.padding(AppSpacing.LG)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Text(
                                    text = if (winnerName != null) "$winnerName é mais barato!" else "Empate técnico!",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }

                            Spacer(modifier = Modifier.height(AppSpacing.MD))

                            val unit = comparisonResult.standardUnit ?: ""
                            val p1Per = comparisonResult.unitPrice1?.let { currencyFormatter.format(it) } ?: "R$ 0,00"
                            val p2Per = comparisonResult.unitPrice2?.let { currencyFormatter.format(it) } ?: "R$ 0,00"

                            Text(
                                text = "• Opção 1: $p1Per por $unit",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Text(
                                text = "• Opção 2: $p2Per por $unit",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )

                            if (comparisonResult.savingsPercentage != null && comparisonResult.savingsPercentage > 0.0) {
                                Spacer(modifier = Modifier.height(AppSpacing.SM))
                                val savingsFormatted = String.format(Locale.ROOT, "%.1f", comparisonResult.savingsPercentage)
                                Surface(
                                    shape = AppShapes.Small,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "Economia de $savingsFormatted% escolhendo a melhor opção.",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        modifier = Modifier.padding(AppSpacing.SM)
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = AppShapes.Medium,
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(AppSpacing.LG),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error
                            )
                            Text(
                                text = comparisonResult.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }
                    }
                }
            }

            // Botão Limpar
            OutlinedButton(
                onClick = {
                    name1 = "Item 1"
                    price1Str = ""
                    qty1Str = ""
                    unit1 = "kg"
                    name2 = "Item 2"
                    price2Str = ""
                    qty2Str = ""
                    unit2 = "kg"
                },
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium
            ) {
                Icon(Icons.Default.Clear, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(AppSpacing.SM))
                Text("Limpar Campos")
            }

            Spacer(modifier = Modifier.height(AppSpacing.XL))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ItemInputCard(
    title: String,
    name: String,
    onNameChange: (String) -> Unit,
    priceStr: String,
    onPriceChange: (String) -> Unit,
    qtyStr: String,
    onQtyChange: (String) -> Unit,
    selectedUnit: String,
    onUnitChange: (String) -> Unit,
    isWinner: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = AppShapes.Medium,
        colors = CardDefaults.cardColors(
            containerColor = if (isWinner) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isWinner) 2.dp else 1.dp),
        border = if (isWinner) androidx.compose.foundation.BorderStroke(2.dp, Color(0xFF10B981)) else null
    ) {
        Column(modifier = Modifier.padding(AppSpacing.LG)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (isWinner) {
                    Surface(
                        shape = AppShapes.Full,
                        color = Color(0xFF10B981)
                    ) {
                        Text(
                            text = "✓ Mais barato",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = AppSpacing.MD, vertical = AppSpacing.XS)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.SM))

            OutlinedTextField(
                value = name,
                onValueChange = onNameChange,
                label = { Text("Nome / Descrição") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = AppShapes.Small
            )

            Spacer(modifier = Modifier.height(AppSpacing.SM))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
            ) {
                OutlinedTextField(
                    value = priceStr,
                    onValueChange = onPriceChange,
                    label = { Text("Preço") },
                    placeholder = { Text("0,00") },
                    prefix = { Text("R$ ") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1.2f),
                    singleLine = true,
                    shape = AppShapes.Small
                )

                OutlinedTextField(
                    value = qtyStr,
                    onValueChange = onQtyChange,
                    label = { Text("Quantidade") },
                    placeholder = { Text("1") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = AppShapes.Small
                )
            }

            Spacer(modifier = Modifier.height(AppSpacing.SM))

            // Chips de unidade rápida (un, kg, g, l, ml, pc, cx)
            val units = listOf("un", "kg", "g", "l", "ml", "pc", "cx")
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.XS)
            ) {
                units.forEach { u ->
                    val isSelected = selectedUnit.equals(u, ignoreCase = true)
                    Surface(
                        onClick = { onUnitChange(u) },
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(6.dp),
                        color = if (isSelected) com.prati.meugasto.ui.theme.PrimaryBrand else MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier.padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = u,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = if (isSelected) androidx.compose.ui.text.font.FontWeight.Bold else androidx.compose.ui.text.font.FontWeight.Normal
                                ),
                                color = if (isSelected) androidx.compose.ui.graphics.Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}
