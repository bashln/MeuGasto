package com.prati.meugasto.ui.components.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.prati.meugasto.ui.theme.extendedColors

data class BarChartData(
    val label: String,
    val value: Double,
    val color: Color = Color.Unspecified
)

@Composable
fun MarketSpendingChart(
    data: List<BarChartData>,
    modifier: Modifier = Modifier
) {
    if (data.isEmpty()) return

    val extended = extendedColors()
    val chartPalette = listOf(extended.chartPrimary, extended.chartSecondary, extended.chartTertiary)
    val coloredData = data.mapIndexed { index, item ->
        if (item.color == Color.Unspecified) item.copy(color = chartPalette[index % chartPalette.size]) else item
    }

    val maxValue = coloredData.maxOf { it.value }.coerceAtLeast(1.0)

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(160.dp)
    ) {
        val width = size.width
        val height = size.height
        val padding = 8.dp.toPx()
        val chartWidth = width - padding * 2
        val chartHeight = height - padding * 2

        val maxBarWidth = 44.dp.toPx()
        val slot = chartWidth / coloredData.size
        val barWidth = minOf(slot * 0.55f, maxBarWidth)

        coloredData.forEachIndexed { index, item ->
            // Headroom visual para a barra não encostar no topo
            val barHeight = (chartHeight * item.value / maxValue * 0.90).toFloat().coerceAtLeast(4.dp.toPx())
            val slotCenterX = padding + index * slot + slot / 2f
            val x = slotCenterX - barWidth / 2f
            val y = padding + chartHeight - barHeight

            drawRoundRect(
                color = item.color,
                topLeft = Offset(x, y),
                size = Size(barWidth, barHeight),
                cornerRadius = CornerRadius(8.dp.toPx(), 8.dp.toPx())
            )
        }
    }
}
