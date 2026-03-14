import * as SecureStore from 'expo-secure-store';

const ONBOARDING_COMPLETED_KEY = 'onboarding.completed';

let lastKnownCompleted: boolean | null = null;

const logOnboardingError = (message: string, error: unknown) => {
  if (__DEV__) {
    console.warn(message, error);
  }
};

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Escaneie suas notas',
    description: 'Use a câmera para escanear o QR Code da NFC-e e importas suas compras automaticamente.',
    icon: 'qrcode-scan',
  },
  {
    id: 2,
    title: 'Acompanhe seus gastos',
    description: 'No dashboard você vê o total gasto no mês, comparação com meses anteriores e insights.',
    icon: 'chart-bar',
  },
  {
    id: 3,
    title: 'Organize suas compras',
    description: 'Na aba Compras você vê todas as notas importadas e pode editar compras manuais.',
    icon: 'cart',
  },
];

export const onboardingService = {
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY);
      const completed = value === 'true';
      lastKnownCompleted = completed;
      return completed;
    } catch (error) {
      logOnboardingError('[Onboarding] Failed to read onboarding state, using safe fallback.', error);
      return lastKnownCompleted ?? true;
    }
  },

  async completeOnboarding(): Promise<boolean> {
    lastKnownCompleted = true;
    try {
      await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, 'true');
      return true;
    } catch (error) {
      logOnboardingError('[Onboarding] Failed to persist onboarding completion.', error);
      return false;
    }
  },

  async resetOnboarding(): Promise<void> {
    lastKnownCompleted = false;
    try {
      await SecureStore.deleteItemAsync(ONBOARDING_COMPLETED_KEY);
    } catch (error) {
      logOnboardingError('[Onboarding] Failed to reset onboarding state.', error);
    }
  },
};
