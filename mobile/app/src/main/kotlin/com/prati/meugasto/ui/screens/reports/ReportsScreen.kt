package com.prati.meugasto.ui.screens.reports

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.prati.meugasto.ui.components.AppTopBar
import com.prati.meugasto.ui.components.EmptyState
import com.prati.meugasto.ui.theme.AppSpacing

@Composable
fun ReportsScreen() {
    Scaffold(
        topBar = {
            AppTopBar(title = "Relatórios")
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = AppSpacing.LG)
        ) {
            EmptyState(
                icon = Icons.Default.BarChart,
                title = "Relatórios em breve",
                description = "Gráficos de gastos, comparação de preços e histórico de produtos serão disponibilizados em uma próxima atualização."
            )
        }
    }
}
