package com.prati.meugasto.ui.screens.planning

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ShoppingListEntity
import com.prati.meugasto.data.local.database.ShoppingListItemEntity
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShoppingListScreen(
    database: AppDatabase
) {
    val coroutineScope = rememberCoroutineScope()
    val lists by database.shoppingListDao().getAllLists().collectAsState(initial = emptyList())
    var activeList by remember { mutableStateOf<ShoppingListEntity?>(null) }
    var newItemName by remember { mutableStateOf("") }
    var newItemQtd by remember { mutableStateOf("1") }
    var newItemPrice by remember { mutableStateOf("") }

    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    // Garantir lista ativa padrão
    LaunchedEffect(lists) {
        if (lists.isNotEmpty() && activeList == null) {
            activeList = lists.first().shoppingList
        } else if (lists.isEmpty()) {
            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val defaultId = database.shoppingListDao().insertList(
                ShoppingListEntity(name = "Minha Lista de Compras", createdAt = now, updatedAt = now)
            )
            activeList = ShoppingListEntity(id = defaultId, name = "Minha Lista de Compras", createdAt = now, updatedAt = now)
        }
    }

    val currentListDetail = lists.firstOrNull { it.shoppingList.id == activeList?.id }
    val itemsList = currentListDetail?.items ?: emptyList()
    val estimatedTotal = itemsList.sumOf { it.quantity * it.estimatedPrice }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Planejamento & Lista", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
        ) {
            // Card de Custo Estimado
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Estimativa da Lista",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        Text(
                            text = "${itemsList.size} itens planejados",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                    Text(
                        text = currencyFormat.format(estimatedTotal),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Formulário de adição rápida
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newItemName,
                    onValueChange = { newItemName = it },
                    label = { Text("Novo item") },
                    modifier = Modifier.weight(2f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = newItemQtd,
                    onValueChange = { newItemQtd = it },
                    label = { Text("Qtd") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                IconButton(
                    onClick = {
                        if (newItemName.isNotBlank() && activeList != null) {
                            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                            val qtd = newItemQtd.replace(",", ".").toDoubleOrNull() ?: 1.0
                            val price = newItemPrice.replace(",", ".").toDoubleOrNull() ?: 0.0

                            coroutineScope.launch {
                                database.shoppingListDao().insertItem(
                                    ShoppingListItemEntity(
                                        shoppingListId = activeList!!.id,
                                        name = newItemName.trim(),
                                        quantity = qtd,
                                        unit = "UN",
                                        estimatedPrice = price,
                                        createdAt = now
                                    )
                                )
                                newItemName = ""
                                newItemQtd = "1"
                                newItemPrice = ""
                            }
                        }
                    }
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Adicionar", tint = MaterialTheme.colorScheme.primary)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Lista de itens
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(itemsList) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = item.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "Qtd: ${item.quantity} ${item.unit}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            IconButton(
                                onClick = {
                                    coroutineScope.launch {
                                        database.shoppingListDao().deleteItem(item)
                                    }
                                }
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Remover", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
        }
    }
}

