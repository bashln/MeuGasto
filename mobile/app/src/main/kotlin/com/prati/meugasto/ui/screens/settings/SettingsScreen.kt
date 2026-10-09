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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import com.prati.meugasto.BuildConfig
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.update.InAppUpdateManager
import com.prati.meugasto.update.UpdateInfo
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    preferences: UserPreferences,
    onNavigateBack: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToLogin: () -> Unit = {},
    onSignOut: () -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val appMode by preferences.appMode.collectAsState()
    val updateManager = remember { InAppUpdateManager(context) }

    var updateStatus by remember { mutableStateOf<String?>(null) }
    var updateInfo by remember { mutableStateOf<UpdateInfo?>(null) }
    var isCheckingUpdate by remember { mutableStateOf(false) }

    // WebDAV states
    var webDavUrl by remember { mutableStateOf(preferences.getWebDavUrl() ?: "") }
    var webDavUser by remember { mutableStateOf(preferences.getWebDavUser() ?: "") }
    var webDavPass by remember { mutableStateOf(preferences.getWebDavPass() ?: "") }

    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Ajustes",
                navigationIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onNavigateBack = onNavigateBack,
                actions = listOf(
                    com.prati.meugasto.ui.components.TopBarAction(
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

            // Seletor de Modo (Cloud vs Local-First)
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
                        text = if (appMode == AppMode.CLOUD)
                            "Modo Nuvem (Supabase): dados sincronizados com sua conta online de forma segura e privada."
                        else
                            "Modo Local-First: dados armazenados 100% no seu dispositivo. Opcionalmente faça backup em sua própria nuvem (WebDAV).",
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

            // Seletor de Tema
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
                        text = "Escolha entre o tema Claro original (Laranja MeuGasto), Escuro ou Seguir o Sistema.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.MD))
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                        SegmentedButton(
                            selected = currentThemeMode == com.prati.meugasto.data.local.preferences.ThemeMode.LIGHT,
                            onClick = { preferences.setThemeMode(com.prati.meugasto.data.local.preferences.ThemeMode.LIGHT) },
                            shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3),
                            label = { Text("Claro") }
                        )
                        SegmentedButton(
                            selected = currentThemeMode == com.prati.meugasto.data.local.preferences.ThemeMode.DARK,
                            onClick = { preferences.setThemeMode(com.prati.meugasto.data.local.preferences.ThemeMode.DARK) },
                            shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3),
                            label = { Text("Escuro") }
                        )
                        SegmentedButton(
                            selected = currentThemeMode == com.prati.meugasto.data.local.preferences.ThemeMode.SYSTEM,
                            onClick = { preferences.setThemeMode(com.prati.meugasto.data.local.preferences.ThemeMode.SYSTEM) },
                            shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3),
                            label = { Text("Sistema") }
                        )
                    }
                }
            }

            // Configuração Modo Nuvem (Supabase)
            if (appMode == AppMode.CLOUD) {
                val isConnected = !preferences.getAccessToken().isNullOrBlank() || !preferences.getUserEmail().isNullOrBlank()

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
                                text = "Conta na Nuvem (Supabase)",
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
                            text = if (isConnected)
                                "Sua conta está sincronizada com a infraestrutura Supabase."
                            else
                                "Entre com sua conta Supabase para sincronizar suas compras.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.MD))

                        if (isConnected) {
                            OutlinedTextField(
                                value = preferences.getUserEmail() ?: "usuario@email.com",
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Email Vinculado") },
                                modifier = Modifier.fillMaxWidth(),
                                shape = AppShapes.Small
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.MD))
                            OutlinedButton(
                                onClick = {
                                    onSignOut()
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("Desconectado da conta Supabase.")
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
                            Text(
                                text = "Entre com sua conta MeuGasto para sincronizar. Uma única entrada já conecta este aparelho.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.MD))
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

            // Configuração WebDAV (se no modo Local-First)
            if (appMode == AppMode.LOCAL_FIRST) {
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
                            text = "Backup em Nuvem Pessoal (WebDAV)",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "Nextcloud, ownCloud ou qualquer servidor WebDAV.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.MD))

                        OutlinedTextField(
                            value = webDavUrl,
                            onValueChange = { webDavUrl = it },
                            label = { Text("URL do Servidor WebDAV") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = AppShapes.Small
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.SM))

                        OutlinedTextField(
                            value = webDavUser,
                            onValueChange = { webDavUser = it },
                            label = { Text("Usuário") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = AppShapes.Small
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.SM))

                        OutlinedTextField(
                            value = webDavPass,
                            onValueChange = { webDavPass = it },
                            label = { Text("Senha ou Token de App") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = AppShapes.Small,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false)
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.MD))

                        Button(
                            onClick = {
                                preferences.saveWebDavConfig(webDavUrl, webDavUser, webDavPass)
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Configuração WebDAV salva com sucesso!")
                                }
                            },
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Text("Salvar Configuração")
                        }
                    }
                }
            }

            // Privacidade e Princípios
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
                        text = "O MeuGasto foi construído sob o princípio de Privacidade por Design. Suas notas fiscais e histórico de compras permanecem sob seu controle e nunca são vendidos.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Atualização In-App (Mecanismo GitHub Releases)
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
                            text = updateStatus ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
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
                                updateStatus = "Buscando atualizações..."
                                coroutineScope.launch {
                                    val result = updateManager.checkForUpdates(BuildConfig.VERSION_NAME)
                                    result.onSuccess { info ->
                                        isCheckingUpdate = false
                                        updateInfo = info
                                        if (info.hasUpdate) {
                                            updateStatus = "Nova versão disponível: v${info.latestVersion}"
                                        } else {
                                            updateStatus = "O app já está na versão mais recente."
                                        }
                                    }.onFailure { e ->
                                        isCheckingUpdate = false
                                        updateStatus = "Erro ao buscar atualizações: ${e.message}"
                                    }
                                }
                            },
                            enabled = !isCheckingUpdate,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(AppSpacing.XS))
                            Text("Verificar Atualizações")
                        }

                        if (updateInfo?.hasUpdate == true && updateInfo?.downloadUrl != null) {
                            Button(
                                onClick = {
                                    updateStatus = "Baixando atualização..."
                                    coroutineScope.launch {
                                        updateManager.downloadAndInstallApk(updateInfo!!.downloadUrl!!)
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

