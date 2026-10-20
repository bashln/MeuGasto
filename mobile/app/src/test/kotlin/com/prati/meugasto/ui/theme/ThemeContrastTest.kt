package com.prati.meugasto.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

class ThemeContrastTest {

    private fun channelLuminance(value: Float): Double {
        return if (value <= 0.04045f) {
            value / 12.92
        } else {
            ((value + 0.055) / 1.055).pow(2.4)
        }
    }

    private fun relativeLuminance(color: Color): Double {
        val r = channelLuminance(color.red)
        val g = channelLuminance(color.green)
        val b = channelLuminance(color.blue)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    private fun contrastRatio(c1: Color, c2: Color): Double {
        val l1 = relativeLuminance(c1)
        val l2 = relativeLuminance(c2)
        val lighter = max(l1, l2)
        val darker = min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    }

    @Test
    fun testLightTextContrastMeetsWcagAA() {
        val onBgRatio = contrastRatio(OnBackground, Background)
        assertTrue("OnBackground on Background ratio ($onBgRatio) must be >= 4.5", onBgRatio >= 4.5)

        val onSurfaceRatio = contrastRatio(OnSurface, Surface)
        assertTrue("OnSurface on Surface ratio ($onSurfaceRatio) must be >= 4.5", onSurfaceRatio >= 4.5)

        val onPrimaryRatio = contrastRatio(OnPrimary, Primary)
        assertTrue("OnPrimary on Primary ratio ($onPrimaryRatio) must be >= 3.0", onPrimaryRatio >= 3.0)
    }

    @Test
    fun testDarkTextContrastMeetsWcagAA() {
        val onBgRatio = contrastRatio(OnBackgroundDark, BackgroundDark)
        assertTrue("OnBackgroundDark on BackgroundDark ratio ($onBgRatio) must be >= 4.5", onBgRatio >= 4.5)

        val onSurfaceRatio = contrastRatio(OnSurfaceDark, SurfaceDark)
        assertTrue("OnSurfaceDark on SurfaceDark ratio ($onSurfaceRatio) must be >= 4.5", onSurfaceRatio >= 4.5)
    }

    @Test
    fun testDarkSurfaceHasClearElevationSeparationFromBackground() {
        // SurfaceDark must be visibly distinguished from BackgroundDark
        val lumSurface = relativeLuminance(SurfaceDark)
        val lumBg = relativeLuminance(BackgroundDark)
        assertTrue(
            "SurfaceDark luminance ($lumSurface) must be higher than BackgroundDark ($lumBg)",
            lumSurface > lumBg * 1.3
        )
    }

    @Test
    fun testSecondaryColorPreservesPurpleFamilyInDarkMode() {
        // Secondary in light mode is violet/purple (blue > red and red > green)
        // SecondaryDark must not be orange/peach (where red is much higher than blue)
        assertTrue(
            "SecondaryDark must be in the purple/violet family (blue >= red)",
            SecondaryDark.blue >= SecondaryDark.red * 0.95f
        )
    }
}
