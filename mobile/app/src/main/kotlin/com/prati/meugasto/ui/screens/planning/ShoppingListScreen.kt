package com.prati.meugasto.ui.screens.planning

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ShoppingListEntity
import com.prati.meugasto.data.local.database.ShoppingListItemEntity
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.EmptyState
import com.prati.meugasto.ui.components.MoneyText
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.launch
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
            AppTopBar(title = "Lista de Compras")
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = AppSpacing.LG)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(AppSpacing.LG),
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
                    MoneyText(
                        value = estimatedTotal,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.LG))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = newItemName,
                    onValueChange = { newItemName = it },
                    label = { Text("Novo item") },
                    modifier = Modifier.weight(2f),
                    singleLine = true,
                    shape = AppShapes.Small
                )
                OutlinedTextField(
                    value = newItemQtd,
                    onValueChange = { newItemQtd = it },
                    label = { Text("Qtd") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = AppShapes.Small
                )
                OutlinedTextField(
                    value = newItemPrice,
                    onValueChange = { newItemPrice = it },
                    label = { Text("Preço") },
                    modifier = Modifier.weight(1.2f),
                    singleLine = true,
                    shape = AppShapes.Small,
                    prefix = { Text("R$ ") }
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
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "Adicionar",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.LG))

            if (itemsList.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.Add,
                    title = "Nenhum item na lista",
                    description = "Adicione produtos usando o formulário acima"
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    items(itemsList) { item ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = AppShapes.Small,
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
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
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = "Qtd: ${item.quantity} ${item.unit}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                if (item.estimatedPrice > 0) {
                                    MoneyText(
                                        value = item.estimatedPrice * item.quantity,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                    Spacer(modifier = Modifier.width(AppSpacing.SM))
                                }
                                IconButton(
                                    onClick = {
                                        coroutineScope.launch {
                                            database.shoppingListDao().deleteItem(item)
                                        }
                                    }
                                ) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Remover",
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
