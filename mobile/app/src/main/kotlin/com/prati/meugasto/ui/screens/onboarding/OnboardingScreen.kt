package com.prati.meugasto.ui.screens.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    preferences: UserPreferences,
    onFinish: () -> Unit
) {
    var currentStep by remember { mutableIntStateOf(0) }
    var selectedMode by remember { mutableStateOf(AppMode.LOCAL_FIRST) }

    val steps = listOf(
        OnboardingStep(
            icon = Icons.Default.Security,
            title = "Privacidade Primeiro",
            description = "\"Nem nós sabemos quanto você gasta. Só você.\" Seus dados ficam seguros no seu dispositivo."
        ),
        OnboardingStep(
            icon = Icons.Default.CameraAlt,
            title = "Escaneie Notas Fiscais",
            description = "Aponte o QR Code da NFC-e e o app registra automaticamente todos os itens, preços e mercados."
        ),
        OnboardingStep(
            icon = Icons.Default.Storage,
            title = "Escolha o Modo de Armazenamento",
            description = "Dados locais ou sincronizados na nuvem. Você decide."
        )
    )

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(AppSpacing.XL),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(AppSpacing.LG))

            // Logo icônico MeuGasto (estilo original laranja com cupom fiscal)
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .background(MaterialTheme.colorScheme.primary, androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.ReceiptLong,
                    contentDescription = "MeuGasto Logo",
                    tint = androidx.compose.ui.graphics.Color.White,
                    modifier = Modifier.size(38.dp)
                )
            }
            Spacer(modifier = Modifier.height(AppSpacing.SM))
            Text(
                text = "MeuGasto",
                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(AppSpacing.XL))

            Row(
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.SM)
            ) {
                steps.forEachIndexed { index, _ ->
                    Box(
                        modifier = Modifier
                            .height(4.dp)
                            .weight(1f)
                            .then(
                                if (index <= currentStep)
                                    Modifier.background(MaterialTheme.colorScheme.primary, AppShapes.Small)
                                else
                                    Modifier.background(MaterialTheme.colorScheme.surfaceVariant, AppShapes.Small)
                            )
                    )
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.XXXL))

            AnimatedContent(
                targetState = currentStep,
                transitionSpec = {
                    fadeIn() + slideInHorizontally { it / 3 } togetherWith
                    fadeOut() + slideOutHorizontally { -it / 3 }
                },
                label = "onboarding_step"
            ) { step ->
                when (step) {
                    0, 1 -> {
                        val stepData = steps[step]
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                stepData.icon,
                                contentDescription = null,
                                modifier = Modifier.size(80.dp),
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.XL))
                            Text(
                                text = stepData.title,
                                style = MaterialTheme.typography.headlineSmall,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.MD))
                            Text(
                                text = stepData.description,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                    2 -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = steps[2].title,
                                style = MaterialTheme.typography.headlineSmall,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.MD))
                            Text(
                                text = steps[2].description,
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(AppSpacing.XL))

                            Card(
                                onClick = { selectedMode = AppMode.LOCAL_FIRST },
                                modifier = Modifier.fillMaxWidth(),
                                shape = AppShapes.Medium,
                                colors = CardDefaults.cardColors(
                                    containerColor = if (selectedMode == AppMode.LOCAL_FIRST)
                                        MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surface
                                ),
                                border = if (selectedMode == AppMode.LOCAL_FIRST)
                                    CardDefaults.outlinedCardBorder().copy(
                                        brush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.primary)
                                    )
                                else null
                            ) {
                                Row(
                                    modifier = Modifier.padding(AppSpacing.LG),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Storage, contentDescription = null, modifier = Modifier.size(32.dp))
                                    Spacer(modifier = Modifier.width(AppSpacing.MD))
                                    Column {
                                        Text(
                                            text = "Modo Local-First",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "Dados 100% no seu aparelho. Suporte a backup WebDAV.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(AppSpacing.MD))

                            Card(
                                onClick = { selectedMode = AppMode.CLOUD },
                                modifier = Modifier.fillMaxWidth(),
                                shape = AppShapes.Medium,
                                colors = CardDefaults.cardColors(
                                    containerColor = if (selectedMode == AppMode.CLOUD)
                                        MaterialTheme.colorScheme.primaryContainer
                                    else MaterialTheme.colorScheme.surface
                                ),
                                border = if (selectedMode == AppMode.CLOUD)
                                    CardDefaults.outlinedCardBorder().copy(
                                        brush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.primary)
                                    )
                                else null
                            ) {
                                Row(
                                    modifier = Modifier.padding(AppSpacing.LG),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Cloud, contentDescription = null, modifier = Modifier.size(32.dp))
                                    Spacer(modifier = Modifier.width(AppSpacing.MD))
                                    Column {
                                        Text(
                                            text = "Modo Nuvem",
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "Sincronização com Supabase e criptografia.",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Button(
                onClick = {
                    if (currentStep < steps.lastIndex) {
                        currentStep++
                    } else {
                        preferences.setAppMode(selectedMode)
                        preferences.setOnboardingCompleted(true)
                        onFinish()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = AppShapes.Medium
            ) {
                Text(
                    text = if (currentStep < steps.lastIndex) "Próximo" else "Começar a Usar",
                    style = MaterialTheme.typography.labelLarge
                )
            }

            if (currentStep > 0) {
                Spacer(modifier = Modifier.height(AppSpacing.MD))
                TextButton(
                    onClick = { if (currentStep > 0) currentStep-- }
                ) {
                    Text("Voltar")
                }
            }

            Spacer(modifier = Modifier.height(AppSpacing.XL))
        }
    }
}

private data class OnboardingStep(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val title: String,
    val description: String
)
