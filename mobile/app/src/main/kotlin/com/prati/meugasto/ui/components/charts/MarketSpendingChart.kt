package com.prati.meugasto.ui.components.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.prati.meugasto.ui.theme.ChartPrimary
import com.prati.meugasto.ui.theme.ChartSecondary
import com.prati.meugasto.ui.theme.ChartTertiary

data class BarChartData(
    val label: String,
    val value: Double,
    val color: Color = ChartPrimary
)

private val chartColors = listOf(ChartPrimary, ChartSecondary, ChartTertiary)

@Composable
fun MarketSpendingChart(
    data: List<BarChartData>,
    modifier: Modifier = Modifier
) {
    if (data.isEmpty()) return

    val maxValue = data.maxOf { it.value }.coerceAtLeast(1.0)
    val coloredData = data.mapIndexed { index, item ->
        item.copy(color = chartColors[index % chartColors.size])
    }

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

        val barWidth = (chartWidth / data.size) * 0.6f
        val gap = (chartWidth / data.size) * 0.4f

        coloredData.forEachIndexed { index, item ->
            val barHeight = (chartHeight * item.value / maxValue).toFloat()
            val x = padding + index * (barWidth + gap) + gap / 2
            val y = padding + chartHeight - barHeight

            drawRect(
                color = item.color,
                topLeft = Offset(x, y),
                size = Size(barWidth, barHeight)
            )
        }
    }
}
