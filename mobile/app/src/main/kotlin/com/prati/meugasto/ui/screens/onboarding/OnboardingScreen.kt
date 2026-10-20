package com.prati.meugasto.ui.screens.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import com.prati.meugasto.ui.theme.AppShapes
import com.prati.meugasto.ui.theme.AppSpacing

@Composable
fun OnboardingScreen(
    preferences: UserPreferences,
    onFinish: () -> Unit
) {
    var currentStep by remember { mutableIntStateOf(0) }

    val steps = listOf(
        OnboardingStep(
            icon = Icons.Default.CameraAlt,
            title = "Registro Automático",
            description = "Aponte a câmera para o QR Code da nota fiscal. O MeuGasto extrai itens, quantidades, preços e supermercados instantaneamente."
        ),
        OnboardingStep(
            icon = Icons.Default.Security,
            title = "Privacidade por Design",
            description = "Nem nós sabemos quanto você gasta. Seus dados de consumo pertencem apenas a você e ficam armazenados no seu dispositivo."
        ),
        OnboardingStep(
            icon = Icons.AutoMirrored.Filled.ReceiptLong,
            title = "Consciência Financeira",
            description = "Monitore a evolução dos seus gastos por categoria, compare preços entre estabelecimentos e mantenha controle real das suas compras."
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

            Box(
                modifier = Modifier
                    .size(68.dp)
                    .background(MaterialTheme.colorScheme.primary, androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ReceiptLong,
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
                modifier = Modifier.fillMaxWidth(),
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

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                AnimatedContent(
                    targetState = currentStep,
                    transitionSpec = {
                        fadeIn() + slideInHorizontally { it / 3 } togetherWith
                            fadeOut() + slideOutHorizontally { -it / 3 }
                    },
                    label = "onboarding_step"
                ) { step ->
                    val stepData = steps[step]
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = AppSpacing.MD)
                    ) {
                        Surface(
                            shape = androidx.compose.foundation.shape.CircleShape,
                            color = MaterialTheme.colorScheme.primaryContainer,
                            modifier = Modifier.size(112.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    stepData.icon,
                                    contentDescription = null,
                                    modifier = Modifier.size(56.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(AppSpacing.XXL))
                        Text(
                            text = stepData.title,
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurface
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
            }

            Button(
                onClick = {
                    if (currentStep < steps.lastIndex) {
                        currentStep++
                    } else {
                        preferences.setAppMode(AppMode.LOCAL_FIRST)
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
                Spacer(modifier = Modifier.height(AppSpacing.SM))
                TextButton(
                    onClick = { if (currentStep > 0) currentStep-- }
                ) {
                    Text("Voltar")
                }
            } else {
                Spacer(modifier = Modifier.height(48.dp))
            }

            Spacer(modifier = Modifier.height(AppSpacing.MD))
        }
    }
}

private data class OnboardingStep(
    val icon: ImageVector,
    val title: String,
    val description: String
)
