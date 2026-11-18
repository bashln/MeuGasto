package com.prati.meugasto.ui.screens.onboarding

import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingFlowTest {

    @Test
    fun `completeOnboarding sets local first mode and marks onboarding completed`() {
        val preferences = mockk<UserPreferences>(relaxed = true)
        every { preferences.setAppMode(any()) } just Runs
        every { preferences.setOnboardingCompleted(any()) } just Runs

        completeOnboarding(preferences)

        verify(exactly = 1) { preferences.setAppMode(AppMode.LOCAL_FIRST) }
        verify(exactly = 1) { preferences.setOnboardingCompleted(true) }
    }

    @Test
    fun `defaultOnboardingSteps exposes three core steps and aligns privacy copy with ADR 0001`() {
        val steps = defaultOnboardingSteps()

        assertEquals(
            listOf("Registro Automático", "Privacidade por Design", "Consciência Financeira"),
            steps.map { it.title }
        )
        val privacyText = steps[1].description
        assertFalse(privacyText.contains("Nem nós sabemos", ignoreCase = true))
        assertTrue(privacyText.contains("modo local", ignoreCase = true))
        assertTrue(privacyText.contains("TLS", ignoreCase = false))
    }
}
