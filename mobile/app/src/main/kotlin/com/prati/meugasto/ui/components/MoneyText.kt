package com.prati.meugasto.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import java.text.NumberFormat
import java.util.Locale

@Composable
fun MoneyText(
    value: Double,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyLarge,
    color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface
) {
    val format = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
    Text(
        text = format.format(value),
        modifier = modifier,
        style = style,
        color = color
    )
}
