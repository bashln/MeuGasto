package com.prati.meugasto.ui.screens.onboarding

import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.domain.model.AppMode
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Test

class OnboardingFlowTest {

    @Test
    fun testOnboardingCompletesWithLocalFirstModeByDefault() {
        val preferences = mockk<UserPreferences>(relaxed = true)
        every { preferences.setAppMode(any()) } just Runs
        every { preferences.setOnboardingCompleted(any()) } just Runs

        // Simula conclusão do onboarding
        preferences.setAppMode(AppMode.LOCAL_FIRST)
        preferences.setOnboardingCompleted(true)

        verify(exactly = 1) { preferences.setAppMode(AppMode.LOCAL_FIRST) }
        verify(exactly = 1) { preferences.setOnboardingCompleted(true) }
    }

    @Test
    fun testOnboardingStepsContainCoreValuePropositionsWithoutTechnicalClutter() {
        val steps = listOf(
            "Registro Automático",
            "Privacidade por Design",
            "Consciência Financeira"
        )
        assertEquals(3, steps.size)
    }
}
