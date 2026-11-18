package com.prati.meugasto.ui.screens.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.remote.supabase.SupabaseAuthRepository
import com.prati.meugasto.data.remote.supabase.SupabaseException
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing
import kotlinx.coroutines.launch

/**
 * Entrada única na conta. Autenticar aqui já liga o modo nuvem e dispara a
 * sincronização: não existe uma segunda etapa de "conectar à nuvem".
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    authRepository: SupabaseAuthRepository,
    onLoggedIn: () -> Unit,
    onNavigateBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var isSignUp by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val isConfigured = authRepository.isConfigured
    val canSubmit = isConfigured && email.isNotBlank() && password.length >= 6 && !isLoading

    fun submit() {
        if (!canSubmit) return
        coroutineScope.launch {
            isLoading = true
            errorMessage = null
            val result = if (isSignUp) {
                authRepository.signUp(email.trim(), password, name.trim().ifBlank { null })
            } else {
                authRepository.signIn(email.trim(), password)
            }
            isLoading = false
            result.onSuccess {
                onLoggedIn()
            }.onFailure { e ->
                errorMessage = when (e) {
                    is SupabaseException -> e.message ?: "Não foi possível entrar."
                    else -> "Não foi possível entrar. Verifique sua conexão."
                }
            }
        }
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = if (isSignUp) "Criar Conta" else "Entrar",
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
            Spacer(modifier = Modifier.height(AppSpacing.XS))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            ) {
                Row(
                    modifier = Modifier.padding(AppSpacing.LG),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
                ) {
                    Icon(
                        Icons.Default.Cloud,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = "Entre para sincronizar suas compras entre aparelhos. No modo local seus dados ficam só neste celular.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            if (!isConfigured) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Medium,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(
                        text = "A conta na nuvem não está configurada nesta compilação.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(AppSpacing.LG)
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = AppShapes.Medium,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Column(modifier = Modifier.padding(AppSpacing.LG)) {
                    Text(
                        text = if (isSignUp) "Criar uma conta" else "Acessar sua conta",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                    )
                    Spacer(modifier = Modifier.height(AppSpacing.MD))

                    if (isSignUp) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Nome") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            shape = AppShapes.Small,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next)
                        )
                        Spacer(modifier = Modifier.height(AppSpacing.SM))
                    }

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("E-mail") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        )
                    )

                    Spacer(modifier = Modifier.height(AppSpacing.SM))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Senha (mínimo 6 caracteres)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = AppShapes.Small,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        )
                    )

                    if (errorMessage != null) {
                        Spacer(modifier = Modifier.height(AppSpacing.SM))
                        Text(
                            text = errorMessage ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    }

                    Spacer(modifier = Modifier.height(AppSpacing.LG))

                    Button(
                        onClick = { submit() },
                        enabled = canSubmit,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(AppSpacing.SM))
                        }
                        Text(if (isSignUp) "Criar Conta" else "Entrar")
                    }

                    Spacer(modifier = Modifier.height(AppSpacing.SM))

                    TextButton(
                        onClick = {
                            isSignUp = !isSignUp
                            errorMessage = null
                        },
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(AppSpacing.XS))
                        Text(if (isSignUp) "Já tenho conta" else "Criar uma conta")
                    }
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.XXL))
        }
    }
}
