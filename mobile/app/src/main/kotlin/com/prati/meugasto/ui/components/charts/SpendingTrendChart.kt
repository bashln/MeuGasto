package com.prati.meugasto.ui.components.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.prati.meugasto.ui.theme.ChartPrimary

data class LineChartData(
    val label: String,
    val value: Double
)

@Composable
fun SpendingTrendChart(
    data: List<LineChartData>,
    modifier: Modifier = Modifier,
    lineColor: Color = ChartPrimary,
    fillColor: Color = ChartPrimary.copy(alpha = 0.1f)
) {
    if (data.isEmpty()) return

    val maxValue = data.maxOf { it.value }.coerceAtLeast(1.0)

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

        val stepX = if (data.size > 1) chartWidth / (data.size - 1) else chartWidth

        val path = Path()
        val fillPath = Path()

        data.forEachIndexed { index, point ->
            val x = padding + index * stepX
            val y = padding + chartHeight * (1 - point.value / maxValue).toFloat()

            if (index == 0) {
                path.moveTo(x, y)
                fillPath.moveTo(x, height - padding)
                fillPath.lineTo(x, y)
            } else {
                path.lineTo(x, y)
                fillPath.lineTo(x, y)
            }
        }

        fillPath.lineTo(padding + (data.size - 1) * stepX, height - padding)
        fillPath.close()

        drawPath(
            path = fillPath,
            color = fillColor
        )

        drawPath(
            path = path,
            color = lineColor,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
        )

        data.forEachIndexed { index, point ->
            val x = padding + index * stepX
            val y = padding + chartHeight * (1 - point.value / maxValue).toFloat()

            drawCircle(
                color = lineColor,
                radius = 3.dp.toPx(),
                center = Offset(x, y)
            )
        }
    }
}
