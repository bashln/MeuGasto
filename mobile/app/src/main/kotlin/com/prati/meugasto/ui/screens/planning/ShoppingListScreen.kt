package com.prati.meugasto.ui.screens.planning

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CompareArrows
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.database.ShoppingListEntity
import com.prati.meugasto.data.local.database.ShoppingListItemEntity
import com.prati.meugasto.domain.model.PriceInput
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
    database: AppDatabase,
    onNavigateBack: (() -> Unit)? = null,
    onNavigateToComparison: () -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    val listsState by database.shoppingListDao().getAllLists().collectAsState(initial = null)
    var activeListId by rememberSaveable { mutableStateOf<Long?>(null) }
    var isCreatingDefaultList by remember { mutableStateOf(false) }
    var newItemName by rememberSaveable { mutableStateOf("") }
    var newItemQtd by rememberSaveable { mutableStateOf("1") }
    var newItemPrice by rememberSaveable { mutableStateOf("") }
    var editingItem by remember { mutableStateOf<ShoppingListItemEntity?>(null) }
    var editingPrice by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var editError by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(listsState) {
        val loadedLists = listsState ?: return@LaunchedEffect
        if (loadedLists.isEmpty() && !isCreatingDefaultList) {
            isCreatingDefaultList = true
            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val defaultId = database.shoppingListDao().insertList(
                ShoppingListEntity(
                    name = "Minha Lista de Compras",
                    createdAt = now,
                    updatedAt = now
                )
            )
            activeListId = defaultId
            isCreatingDefaultList = false
        } else if (loadedLists.isNotEmpty() &&
            (activeListId == null || loadedLists.none { it.shoppingList.id == activeListId })
        ) {
            val preferred = loadedLists.firstOrNull { it.items.isNotEmpty() } ?: loadedLists.first()
            activeListId = preferred.shoppingList.id
        }
    }

    val currentLists = listsState
    val currentListDetail = currentLists?.firstOrNull { it.shoppingList.id == activeListId }
        ?: currentLists?.firstOrNull { it.items.isNotEmpty() }
        ?: currentLists?.firstOrNull()
    val activeList = currentListDetail?.shoppingList
    val itemsList = currentListDetail?.items ?: emptyList()
    val estimatedTotal = itemsList.sumOf { it.quantity * it.estimatedPrice }

    fun submitNewItem() {
        val list = activeList
        val qtd = PriceInput.parseQuantity(newItemQtd)
        val price = if (newItemPrice.isBlank()) {
            0.0
        } else {
            PriceInput.parseEstimatedPrice(newItemPrice)
        }
        formError = when {
            newItemName.isBlank() -> "Informe o nome do produto."
            list == null -> "Aguarde o carregamento da lista."
            qtd == null -> "Quantidade inválida."
            price == null -> "Preço inválido."
            else -> null
        }
        if (newItemName.isNotBlank() && list != null && qtd != null && price != null) {
            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            coroutineScope.launch {
                database.shoppingListDao().insertItem(
                    ShoppingListItemEntity(
                        shoppingListId = list.id,
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
                formError = null
            }
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Lista de Compras",
                navigationIcon = if (onNavigateBack != null) Icons.AutoMirrored.Filled.ArrowBack else null,
                onNavigateBack = onNavigateBack ?: {},
                actions = listOf(
                    com.prati.meugasto.ui.components.TopBarAction(
                        icon = Icons.AutoMirrored.Filled.CompareArrows,
                        contentDescription = "Comparar Preços",
                        onClick = onNavigateToComparison
                    )
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = AppSpacing.LG)
        ) {
            Spacer(modifier = Modifier.height(AppSpacing.MD))
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

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(AppSpacing.LG)) {
                    OutlinedTextField(
                        value = newItemName,
                        onValueChange = {
                            newItemName = it
                            formError = null
                        },
                        label = { Text("Novo item") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next)
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.SM))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = newItemQtd,
                            onValueChange = {
                                newItemQtd = it
                                formError = null
                            },
                            label = { Text("Qtd") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            shape = AppShapes.Small,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Decimal,
                                imeAction = ImeAction.Next
                            )
                        )
                        OutlinedTextField(
                            value = newItemPrice,
                            onValueChange = {
                                newItemPrice = it
                                formError = null
                            },
                            label = { Text("Preço") },
                            modifier = Modifier.weight(1.4f),
                            singleLine = true,
                            shape = AppShapes.Small,
                            prefix = { Text("R$ ") },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Decimal,
                                imeAction = ImeAction.Done
                            ),
                            keyboardActions = KeyboardActions(onDone = { submitNewItem() })
                        )
                        FilledIconButton(
                            onClick = { submitNewItem() },
                            modifier = Modifier.size(56.dp),
                            colors = IconButtonDefaults.filledIconButtonColors(
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary
                            )
                        ) {
                            Icon(
                                Icons.Default.Add,
                                contentDescription = "Adicionar item à lista"
                            )
                        }
                    }
                    formError?.let { message ->
                        Spacer(modifier = Modifier.height(AppSpacing.XS))
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.LG))

            if (currentLists == null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (itemsList.isEmpty()) {
                EmptyState(
                    icon = Icons.Default.Checklist,
                    title = "Nenhum item na lista",
                    description = "Adicione produtos usando o formulário acima"
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    items(itemsList, key = { it.id }) { item ->
                        val formattedQty = remember(item.quantity) {
                            if (item.quantity % 1.0 == 0.0) {
                                item.quantity.toLong().toString()
                            } else {
                                item.quantity.toString().replace('.', ',')
                            }
                        }
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
                                        text = "Qtd: $formattedQty ${item.unit}",
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
                                        editingItem = item
                                        editError = null
                                        editingPrice = if (item.estimatedPrice > 0) {
                                            item.estimatedPrice.toString().replace(".", ",")
                                        } else {
                                            ""
                                        }
                                    }
                                ) {
                                    Icon(
                                        Icons.Default.Edit,
                                        contentDescription = "Editar preço",
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        coroutineScope.launch {
                                            database.shoppingListDao().deleteItem(item)
                                            val result = snackbarHostState.showSnackbar(
                                                message = "Item removido",
                                                actionLabel = "Desfazer",
                                                duration = SnackbarDuration.Short
                                            )
                                            if (result == SnackbarResult.ActionPerformed) {
                                                database.shoppingListDao().insertItem(item)
                                            }
                                        }
                                    }
                                ) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = "Remover item",
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

    if (editingItem != null) {
        AlertDialog(
            onDismissRequest = { editingItem = null },
            title = { Text("Editar preço estimado") },
            text = {
                Column {
                    OutlinedTextField(
                        value = editingPrice,
                        onValueChange = { editingPrice = it },
                        label = { Text("Preço unitário") },
                        prefix = { Text("R$ ") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Decimal,
                            imeAction = ImeAction.Done
                        )
                    )
                    editError?.let { message ->
                        Spacer(modifier = Modifier.height(AppSpacing.XS))
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val item = editingItem
                    val price = PriceInput.parseEstimatedPrice(editingPrice)
                    when {
                        item == null -> editingItem = null
                        price == null -> editError = "Informe um preço válido e não negativo."
                        else -> {
                            coroutineScope.launch {
                                database.shoppingListDao().updateEstimatedPrice(item.id, price)
                            }
                            editingItem = null
                            editError = null
                        }
                    }
                }) { Text("Salvar") }
            },
            dismissButton = {
                TextButton(onClick = { editingItem = null }) { Text("Cancelar") }
            }
        )
    }
}
