package com.prati.meugasto.ui.components.charts

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.prati.meugasto.ui.theme.extendedColors
import kotlin.math.min

data class LineChartData(
    val label: String,
    val value: Double
)

@Composable
fun SpendingTrendChart(
    data: List<LineChartData>,
    modifier: Modifier = Modifier,
    lineColor: Color = extendedColors().chartPrimary
) {
    if (data.isEmpty()) return

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

        if (data.size == 1) {
            val centerPoint = Offset(
                x = width / 2f,
                y = padding + chartHeight * 0.5f
            )
            // Linha guia sutil
            drawLine(
                color = lineColor.copy(alpha = 0.2f),
                start = Offset(padding, centerPoint.y),
                end = Offset(width - padding, centerPoint.y),
                strokeWidth = 1.dp.toPx()
            )
            // Halo e ponto central
            drawCircle(
                color = lineColor.copy(alpha = 0.2f),
                radius = 8.dp.toPx(),
                center = centerPoint
            )
            drawCircle(
                color = lineColor,
                radius = 4.dp.toPx(),
                center = centerPoint
            )
            return@Canvas
        }

        val stepX = chartWidth / (data.size - 1)

        val points = data.mapIndexed { index, point ->
            Offset(
                x = padding + index * stepX,
                y = padding + chartHeight * (1 - point.value / maxValue(data) * 0.88).toFloat()
            )
        }

        // Linha suavizada (cubic) entre os pontos
        val linePath = Path()
        points.forEachIndexed { index, current ->
            if (index == 0) {
                linePath.moveTo(current.x, current.y)
            } else {
                val previous = points[index - 1]
                val midX = (previous.x + current.x) / 2
                linePath.cubicTo(midX, previous.y, midX, current.y, current.x, current.y)
            }
        }

        // Área preenchida com gradiente vertical
        val fillPath = Path().apply {
            addPath(linePath)
            lineTo(points.last().x, height - padding)
            lineTo(points.first().x, height - padding)
            close()
        }
        drawPath(
            path = fillPath,
            brush = Brush.verticalGradient(
                colors = listOf(lineColor.copy(alpha = 0.25f), Color.Transparent),
                startY = padding,
                endY = height - padding
            )
        )

        drawPath(
            path = linePath,
            color = lineColor,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
        )

        points.forEach { point ->
            drawCircle(
                color = lineColor,
                radius = 3.dp.toPx(),
                center = point
            )
        }
    }
}

private fun maxValue(data: List<LineChartData>): Double {
    val max = data.maxOf { it.value }
    return if (max <= 0.0) 1.0 else min(max, Double.MAX_VALUE)
}
