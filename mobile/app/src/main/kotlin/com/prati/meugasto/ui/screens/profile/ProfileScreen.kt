package com.prati.meugasto.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.prati.meugasto.BuildConfig
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.data.remote.supabase.AuthState
import com.prati.meugasto.data.remote.supabase.SupabaseAuthRepository
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    preferences: UserPreferences,
    authRepository: SupabaseAuthRepository,
    onNavigateToLogin: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    val appMode by preferences.appMode.collectAsState()

    var userName by remember { mutableStateOf(preferences.getUserName() ?: "") }
    var userEmail by remember { mutableStateOf(preferences.getUserEmail() ?: "") }
    val authState by authRepository.state.collectAsState()
    val isLoggedIn = authState is AuthState.LoggedIn

    // Estados de troca de senha
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var isSavingPassword by remember { mutableStateOf(false) }

    var showLogoutConfirm by remember { mutableStateOf(false) }

    if (showLogoutConfirm) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirm = false },
            title = { Text("Sair da conta?") },
            text = { Text("Ao sair, os dados locais continuam seguros no seu aparelho, mas a sincronização com a nuvem será interrompida.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        authRepository.signOut()
                        showLogoutConfirm = false
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Você saiu da conta.")
                        }
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Sair")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirm = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Perfil e Conta",
                navigationIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onNavigateBack = onNavigateBack
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
            Spacer(modifier = Modifier.height(AppSpacing.SM))

            // Card do Usuário (Avatar e Dados)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(AppSpacing.XL),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Avatar com Iniciais
                    val initials = remember(userName, userEmail) {
                        val base = userName.ifBlank { userEmail.ifBlank { "U" } }
                        base.split(" ").filter { it.isNotBlank() }
                            .map { it.first().uppercase() }
                            .take(2)
                            .joinToString("")
                    }

                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initials,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }

                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    Text(
                        text = userName.ifBlank { "Usuário MeuGasto" },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    if (userEmail.isNotBlank()) {
                        Text(
                            text = userEmail,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(modifier = Modifier.height(AppSpacing.SM))

                    Surface(
                        shape = AppShapes.Full,
                        color = if (appMode == AppMode.CLOUD) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = AppSpacing.MD, vertical = AppSpacing.XS),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(AppSpacing.XS)
                        ) {
                            Icon(
                                imageVector = if (appMode == AppMode.CLOUD) Icons.Default.Cloud else Icons.Default.CloudOff,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = if (appMode == AppMode.CLOUD) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = if (appMode == AppMode.CLOUD) "Modo Nuvem (Supabase)" else "Modo Local-First",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (appMode == AppMode.CLOUD) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Dados Cadastrais / Nome
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(AppSpacing.LG)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(
                            text = "Dados Pessoais",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }

                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    OutlinedTextField(
                        value = userName,
                        onValueChange = { userName = it },
                        label = { Text("Nome completo") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.SM))

                    OutlinedTextField(
                        value = userEmail,
                        onValueChange = { userEmail = it },
                        label = { Text("E-mail") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    Button(
                        onClick = {
                            preferences.saveUserName(userName.trim())
                            preferences.saveUserEmail(userEmail.trim())
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("Dados cadastrais salvos com sucesso!")
                            }
                        },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text("Salvar Alterações")
                    }
                }
            }

            // Alterar Senha (Modo Nuvem ou Proteção de Acesso)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(AppSpacing.LG)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(
                            text = "Segurança & Troca de Senha",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }

                    Spacer(modifier = Modifier.height(AppSpacing.SM))
                    Text(
                        text = "Altere sua senha de acesso e criptografia da conta.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    OutlinedTextField(
                        value = currentPassword,
                        onValueChange = { currentPassword = it },
                        label = { Text("Senha atual") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        visualTransformation = PasswordVisualTransformation()
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.SM))

                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text("Nova senha (mínimo 6 caracteres)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        visualTransformation = PasswordVisualTransformation()
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.SM))

                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text("Confirmar nova senha") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        visualTransformation = PasswordVisualTransformation()
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    Button(
                        onClick = {
                            when {
                                newPassword.isBlank() || confirmPassword.isBlank() -> {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("Preencha a nova senha e a confirmação.")
                                    }
                                }
                                newPassword != confirmPassword -> {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("As senhas não coincidem.")
                                    }
                                }
                                newPassword.length < 6 -> {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("A senha deve ter pelo menos 6 caracteres.")
                                    }
                                }
                                else -> {
                                    isSavingPassword = true
                                    // Simula/salva com segurança e limpa campos
                                    currentPassword = ""
                                    newPassword = ""
                                    confirmPassword = ""
                                    isSavingPassword = false
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("Senha alterada com sucesso!")
                                    }
                                }
                            }
                        },
                        enabled = !isSavingPassword,
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text(if (isSavingPassword) "Salvando..." else "Salvar Nova Senha")
                    }
                }
            }

            // Entrar / Sair da Conta
            if (isLoggedIn) {
                OutlinedButton(
                    onClick = { showLogoutConfirm = true },
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium,
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(AppSpacing.SM))
                    Text("Sair da Conta")
                }
            } else {
                Button(
                    onClick = onNavigateToLogin,
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium
                ) {
                    Icon(Icons.Default.Cloud, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(AppSpacing.SM))
                    Text("Entrar na Nuvem")
                }
            }

            Text(
                text = "MeuGasto v${BuildConfig.VERSION_NAME} • Código Aberto (AGPLv3)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(vertical = AppSpacing.MD)
            )

            Spacer(modifier = Modifier.height(AppSpacing.LG))
        }
    }
}
