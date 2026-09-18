package com.prati.meugasto.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    secondary = Secondary,
    onSecondary = OnSecondary,
    secondaryContainer = SecondaryContainer,
    onSecondaryContainer = OnSecondaryContainer,
    tertiary = Tertiary,
    onTertiary = OnTertiary,
    tertiaryContainer = TertiaryContainer,
    onTertiaryContainer = OnTertiaryContainer,
    background = Background,
    onBackground = OnBackground,
    surface = Surface,
    onSurface = OnSurface,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceVariant,
    outline = Outline,
    outlineVariant = OutlineVariant,
    error = Negative,
    onError = OnPrimary,
    errorContainer = NegativeContainer,
    onErrorContainer = OnNegativeContainer,
    inversePrimary = PrimaryDark,
    inverseSurface = Color(0xFF2E312D),
    inverseOnSurface = Color(0xFFF1F1EC),
    scrim = Color(0xFF000000)
)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryDark,
    onPrimary = OnPrimaryDark,
    primaryContainer = PrimaryContainerDark,
    onPrimaryContainer = OnPrimaryContainerDark,
    secondary = SecondaryDark,
    onSecondary = OnSecondaryDark,
    secondaryContainer = SecondaryContainerDark,
    onSecondaryContainer = OnSecondaryContainerDark,
    tertiary = TertiaryDark,
    onTertiary = OnTertiaryDark,
    tertiaryContainer = TertiaryContainerDark,
    onTertiaryContainer = OnTertiaryContainerDark,
    background = BackgroundDark,
    onBackground = OnBackgroundDark,
    surface = SurfaceDark,
    onSurface = OnSurfaceDark,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = OnSurfaceVariantDark,
    outline = OutlineDark,
    outlineVariant = OutlineVariantDark,
    error = NegativeDark,
    onError = Color(0xFF690005),
    errorContainer = NegativeContainerDark,
    onErrorContainer = OnNegativeContainerDark,
    inversePrimary = Primary,
    inverseSurface = Color(0xFFE2E3DD),
    inverseOnSurface = Color(0xFF2D302C),
    scrim = Color(0xFF000000)
)

/**
 * Cores semânticas e de gráficos que não têm slot no ColorScheme do Material 3.
 * Fornecidas via CompositionLocal para respeitar light/dark theme.
 */
@Immutable
data class ExtendedColors(
    val positive: Color,
    val onPositive: Color,
    val positiveContainer: Color,
    val onPositiveContainer: Color,
    val negative: Color,
    val onNegative: Color,
    val negativeContainer: Color,
    val onNegativeContainer: Color,
    val warning: Color,
    val onWarning: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val info: Color,
    val onInfo: Color,
    val infoContainer: Color,
    val onInfoContainer: Color,
    val chartPrimary: Color,
    val chartSecondary: Color,
    val chartTertiary: Color,
    val chartQuaternary: Color,
    val chartPositive: Color,
    val chartNegative: Color,
    val chartNeutral: Color
)

val LightExtendedColors = ExtendedColors(
    positive = Positive,
    onPositive = OnPrimary,
    positiveContainer = PositiveContainer,
    onPositiveContainer = OnPositiveContainer,
    negative = Negative,
    onNegative = OnPrimary,
    negativeContainer = NegativeContainer,
    onNegativeContainer = OnNegativeContainer,
    warning = Warning,
    onWarning = OnPrimary,
    warningContainer = WarningContainer,
    onWarningContainer = OnWarningContainer,
    info = Info,
    onInfo = OnPrimary,
    infoContainer = InfoContainer,
    onInfoContainer = OnInfoContainer,
    chartPrimary = ChartPrimary,
    chartSecondary = ChartSecondary,
    chartTertiary = ChartTertiary,
    chartQuaternary = ChartQuaternary,
    chartPositive = ChartPositive,
    chartNegative = ChartNegative,
    chartNeutral = ChartNeutral
)

val DarkExtendedColors = ExtendedColors(
    positive = PositiveDark,
    onPositive = Color(0xFF003924),
    positiveContainer = PositiveContainerDark,
    onPositiveContainer = OnPositiveContainerDark,
    negative = NegativeDark,
    onNegative = Color(0xFF690005),
    negativeContainer = NegativeContainerDark,
    onNegativeContainer = OnNegativeContainerDark,
    warning = WarningDark,
    onWarning = Color(0xFF3F2E00),
    warningContainer = WarningContainerDark,
    onWarningContainer = OnWarningContainerDark,
    info = InfoDark,
    onInfo = Color(0xFF0A1E38),
    infoContainer = InfoContainerDark,
    onInfoContainer = OnInfoContainerDark,
    chartPrimary = ChartPrimaryDark,
    chartSecondary = ChartSecondaryDark,
    chartTertiary = ChartTertiaryDark,
    chartQuaternary = ChartQuaternaryDark,
    chartPositive = ChartPositiveDark,
    chartNegative = ChartNegativeDark,
    chartNeutral = ChartNeutralDark
)

val LocalExtendedColors = staticCompositionLocalOf { LightExtendedColors }

/** Acesso ergonômico às cores semânticas/de gráficos do tema atual. */
@Composable
fun extendedColors(): ExtendedColors = LocalExtendedColors.current

@Composable
fun MeuGastoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Desativado por padrão: o dynamic color (Material You) substituiria toda a
    // brand palette definida no design system pelas cores do wallpaper do usuário.
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val extended = if (darkTheme) DarkExtendedColors else LightExtendedColors
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            if (window != null) {
                window.statusBarColor = colorScheme.primary.toArgb()
                WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            }
        }
    }

    CompositionLocalProvider(LocalExtendedColors provides extended) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = AppTypography.toMaterialTypography(),
            shapes = AppShapes.toMaterialShapes(),
            content = content
        )
    }
}
