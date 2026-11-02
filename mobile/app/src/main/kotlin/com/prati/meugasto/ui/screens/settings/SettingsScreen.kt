package com.prati.meugasto.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.prati.meugasto.BuildConfig
import com.prati.meugasto.data.local.preferences.ThemeMode
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.data.remote.supabase.AuthState
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.TopBarAction
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import com.prati.meugasto.update.InAppUpdateManager
import com.prati.meugasto.update.UpdateInfo
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    preferences: UserPreferences,
    authState: AuthState = AuthState.LoggedOut,
    onNavigateBack: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToLogin: () -> Unit = {},
    onSignOut: suspend () -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val appMode by preferences.appMode.collectAsState()
    val updateManager = remember { InAppUpdateManager(context) }

    var updateStatus by remember { mutableStateOf<String?>(null) }
    var updateHasError by remember { mutableStateOf(false) }
    var updateInfo by remember { mutableStateOf<UpdateInfo?>(null) }
    var isCheckingUpdate by remember { mutableStateOf(false) }
    var isInstallingUpdate by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Ajustes",
                navigationIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onNavigateBack = onNavigateBack,
                actions = listOf(
                    TopBarAction(
                        icon = Icons.Default.Person,
                        contentDescription = "Perfil do Usuário",
                        onClick = onNavigateToProfile
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
                .verticalScroll(rememberScrollState())
                .padding(horizontal = AppSpacing.LG),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.LG)
        ) {
            Spacer(modifier = Modifier.height(AppSpacing.XS))

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
                        text = "Modo de Armazenamento",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.SM))
                    Text(
                        text = if (appMode == AppMode.CLOUD) {
                            "Modo Nuvem (Supabase). Compras sincronizadas via HTTPS com sua conta e isoladas por usuário no banco de dados."
                        } else {
                            "Modo Local-First. Compras e listas ficam gravadas somente no banco local deste aparelho, sem envio para servidores."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.LG))
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        SegmentedButton(
                            selected = appMode == AppMode.CLOUD,
                            onClick = { preferences.setAppMode(AppMode.CLOUD) },
                            shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2),
                            icon = { Icon(Icons.Default.Cloud, contentDescription = null, modifier = Modifier.size(16.dp)) },
                            label = { Text("Nuvem") }
                        )
                        SegmentedButton(
                            selected = appMode == AppMode.LOCAL_FIRST,
                            onClick = { preferences.setAppMode(AppMode.LOCAL_FIRST) },
                            shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2),
                            icon = { Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(16.dp)) },
                            label = { Text("Local-First") }
                        )
                    }
                }
            }

            val currentThemeMode by preferences.themeMode.collectAsState()
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
                        text = "Aparência",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.SM))
                    Text(
                        text = "Escolha entre o tema Claro, Escuro ou Seguir o Sistema.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.MD))
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        SegmentedButton(
                            selected = currentThemeMode == ThemeMode.LIGHT,
                            onClick = { preferences.setThemeMode(ThemeMode.LIGHT) },
                            shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3),
                            label = { Text("Claro") }
                        )
                        SegmentedButton(
                            selected = currentThemeMode == ThemeMode.DARK,
                            onClick = { preferences.setThemeMode(ThemeMode.DARK) },
                            shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3),
                            label = { Text("Escuro") }
                        )
                        SegmentedButton(
                            selected = currentThemeMode == ThemeMode.SYSTEM,
                            onClick = { preferences.setThemeMode(ThemeMode.SYSTEM) },
                            shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3),
                            label = { Text("Sistema") }
                        )
                    }
                }
            }

            if (appMode == AppMode.CLOUD) {
                val loggedInState = authState as? AuthState.LoggedIn
                val isConnected = loggedInState != null

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Column(modifier = Modifier.padding(AppSpacing.LG)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Conta na Nuvem",
                                style = MaterialTheme.typography.titleMedium
                            )
                            Surface(
                                shape = AppShapes.Full,
                                color = if (isConnected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                            ) {
                                Text(
                                    text = if (isConnected) "Conectado" else "Desconectado",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (isConnected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = AppSpacing.SM, vertical = AppSpacing.XS)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(AppSpacing.SM))
                        Text(
                            text = if (isConnected) {
                                "Sua conta está conectada para sincronizar compras entre aparelhos."
                            } else {
                                "Entre com sua conta MeuGasto para sincronizar suas compras."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.MD))

                        if (isConnected) {
                            OutlinedTextField(
                                value = loggedInState?.email ?: preferences.getUserEmail().orEmpty(),
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("E-mail vinculado") },
                                modifier = Modifier.fillMaxWidth(),
                                shape = AppShapes.Small
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.MD))
                            OutlinedButton(
                                onClick = {
                                    coroutineScope.launch {
                                        runCatching { onSignOut() }
                                            .onSuccess {
                                                snackbarHostState.showSnackbar("Conta desconectada deste aparelho.")
                                            }
                                            .onFailure { error ->
                                                snackbarHostState.showSnackbar(
                                                    "Não foi possível sair: ${error.message ?: "tente novamente"}"
                                                )
                                            }
                                    }
                                },
                                modifier = Modifier.align(Alignment.End),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = MaterialTheme.colorScheme.error
                                )
                            ) {
                                Text("Desconectar")
                            }
                        } else {
                            Button(
                                onClick = onNavigateToLogin,
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Entrar na Nuvem")
                            }
                        }
                    }
                }
            }

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
                        text = "Privacidade e Princípios",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.SM))
                    Text(
                        text = "No modo Local-First suas notas e listas ficam restritas ao aparelho e a chave fiscal de 44 dígitos não é gravada em texto puro. Na nuvem opcional, o tráfego usa TLS e os dados pertencem exclusivamente à sua conta.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

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
                        text = "Atualizações do Aplicativo",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.XS))
                    Text(
                        text = "Versão atual: ${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    if (updateStatus != null) {
                        Text(
                            text = updateStatus.orEmpty(),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (updateHasError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.SM))
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.MD),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = {
                                isCheckingUpdate = true
                                updateHasError = false
                                updateStatus = "Buscando atualizações..."
                                coroutineScope.launch {
                                    val result = updateManager.checkForUpdates(BuildConfig.VERSION_NAME)
                                    isCheckingUpdate = false
                                    result.onSuccess { info ->
                                        updateInfo = info
                                        if (info.hasUpdate) {
                                            updateStatus = "Nova versão disponível: v${info.latestVersion}"
                                        } else {
                                            updateStatus = "O app já está na versão mais recente."
                                        }
                                    }.onFailure { e ->
                                        updateHasError = true
                                        updateStatus = "Erro ao buscar atualizações: ${e.message ?: "verifique sua conexão"}"
                                    }
                                }
                            },
                            enabled = !isCheckingUpdate && !isInstallingUpdate,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(AppSpacing.XS))
                            Text("Verificar Atualizações")
                        }

                        val downloadUrl = updateInfo?.downloadUrl
                        if (updateInfo?.hasUpdate == true && downloadUrl != null) {
                            Button(
                                enabled = !isInstallingUpdate && !isCheckingUpdate,
                                onClick = {
                                    isInstallingUpdate = true
                                    updateHasError = false
                                    updateStatus = "Baixando atualização..."
                                    coroutineScope.launch {
                                        val result = updateManager.downloadAndInstallApk(downloadUrl)
                                        isInstallingUpdate = false
                                        result.onSuccess {
                                            updateStatus = "Instalador aberto. Confirme a atualização no Android."
                                        }.onFailure { e ->
                                            updateHasError = true
                                            updateStatus = "Falha ao instalar atualização: ${e.message ?: "tente novamente"}"
                                        }
                                    }
                                }
                            ) {
                                Icon(Icons.Default.SystemUpdate, contentDescription = null)
                                Spacer(modifier = Modifier.width(AppSpacing.XS))
                                Text("Instalar")
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.XXL))
        }
    }
}
