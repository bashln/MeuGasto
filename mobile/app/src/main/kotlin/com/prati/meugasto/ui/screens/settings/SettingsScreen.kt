package com.prati.meugasto.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.prati.meugasto.BuildConfig
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.update.InAppUpdateManager
import com.prati.meugasto.update.UpdateInfo
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    preferences: UserPreferences
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ajustes e Sincronização", fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Seletor de Modo (Cloud vs Local-First)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Modo de Armazenamento",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (appMode == AppMode.CLOUD)
                            "Modo Nuvem (Supabase): Dados sincronizados com sua conta online de forma segura e privada."
                        else
                            "Modo Local-First: Dados armazenados 100% no seu dispositivo. Opcionalmente faça backup em sua própria nuvem (WebDAV).",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { preferences.setAppMode(AppMode.CLOUD) },
                            modifier = Modifier.weight(1f),
                            colors = if (appMode == AppMode.CLOUD)
                                ButtonDefaults.buttonColors()
                            else
                                ButtonDefaults.outlinedButtonColors()
                        ) {
                            Icon(Icons.Default.Cloud, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Supabase")
                        }

                        Button(
                            onClick = { preferences.setAppMode(AppMode.LOCAL_FIRST) },
                            modifier = Modifier.weight(1f),
                            colors = if (appMode == AppMode.LOCAL_FIRST)
                                ButtonDefaults.buttonColors()
                            else
                                ButtonDefaults.outlinedButtonColors()
                        ) {
                            Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Local-First")
                        }
                    }
                }
            }

            // Configuração WebDAV (se no modo Local-First)
            if (appMode == AppMode.LOCAL_FIRST) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Backup em Nuvem Pessoal (WebDAV)",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Nextcloud, ownCloud ou qualquer servidor WebDAV.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = webDavUrl,
                            onValueChange = { webDavUrl = it },
                            label = { Text("URL do Servidor WebDAV") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = webDavUser,
                            onValueChange = { webDavUser = it },
                            label = { Text("Usuário") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = webDavPass,
                            onValueChange = { webDavPass = it },
                            label = { Text("Senha ou Token de App") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = {
                                preferences.saveWebDavConfig(webDavUrl, webDavUser, webDavPass)
                            },
                            modifier = Modifier.align(Alignment.End)
                        ) {
                            Text("Salvar Configuração")
                        }
                    }
                }
            }

            // Atualização In-App (Mecanismo GitHub Releases)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Atualizações do Aplicativo",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Versão atual: ${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    if (updateStatus != null) {
                        Text(
                            text = updateStatus ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
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
                            enabled = !isCheckingUpdate
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Verificar Atualizações")
                        }

                        if (updateInfo?.hasUpdate == true && updateInfo?.downloadUrl != null) {
                            Button(
                                onClick = {
                                    updateStatus = "Baixando atualização..."
                                    coroutineScope.launch {
                                        updateManager.downloadAndInstallApk(updateInfo!!.downloadUrl!!)
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                            ) {
                                Icon(Icons.Default.SystemUpdate, contentDescription = null)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Instalar")
                            }
                        }
                    }
                }
            }
        }
    }
}

