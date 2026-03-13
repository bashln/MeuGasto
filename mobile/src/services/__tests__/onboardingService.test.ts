jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const loadModule = () => {
  let loadedModule: typeof import('../onboardingService');
  let secureStore: typeof import('expo-secure-store');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStore = require('expo-secure-store');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loadedModule = require('../onboardingService');
  });
  return {
    module: loadedModule!,
    mockDeleteItemAsync: secureStore!.deleteItemAsync as jest.Mock,
    mockGetItemAsync: secureStore!.getItemAsync as jest.Mock,
    mockSetItemAsync: secureStore!.setItemAsync as jest.Mock,
  };
};

describe('onboardingService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ONBOARDING_STEPS', () => {
    it('should have 3 steps', () => {
      const { module } = loadModule();
      expect(module.ONBOARDING_STEPS).toHaveLength(3);
    });

    it('should expose expected step metadata', () => {
      const { module } = loadModule();

      expect(module.ONBOARDING_STEPS[0]).toMatchObject({
        title: 'Escaneie suas notas',
        icon: 'qrcode-scan',
      });
      expect(module.ONBOARDING_STEPS[1]).toMatchObject({
        title: 'Acompanhe seus gastos',
        icon: 'chart-bar',
      });
      expect(module.ONBOARDING_STEPS[2]).toMatchObject({
        title: 'Organize suas compras',
        icon: 'cart',
      });
    });
  });

  describe('hasCompletedOnboarding', () => {
    it('should return false when onboarding is not completed', async () => {
      const { module, mockGetItemAsync } = loadModule();
      mockGetItemAsync.mockResolvedValue(null);

      await expect(module.onboardingService.hasCompletedOnboarding()).resolves.toBe(false);
      expect(mockGetItemAsync).toHaveBeenCalledWith('onboarding.completed');
    });

    it('should return true when onboarding is completed', async () => {
      const { module, mockGetItemAsync } = loadModule();
      mockGetItemAsync.mockResolvedValue('true');

      await expect(module.onboardingService.hasCompletedOnboarding()).resolves.toBe(true);
    });

    it('should use safe fallback when initial read fails', async () => {
      const { module, mockGetItemAsync } = loadModule();
      mockGetItemAsync.mockRejectedValueOnce(new Error('read failed'));

      await expect(module.onboardingService.hasCompletedOnboarding()).resolves.toBe(true);
    });

    it('should reuse last known value after a transient read failure', async () => {
      const { module, mockGetItemAsync } = loadModule();
      mockGetItemAsync.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('temporary'));

      await expect(module.onboardingService.hasCompletedOnboarding()).resolves.toBe(false);
      await expect(module.onboardingService.hasCompletedOnboarding()).resolves.toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('should persist onboarding completion', async () => {
      const { module, mockSetItemAsync } = loadModule();
      mockSetItemAsync.mockResolvedValue(undefined);

      await module.onboardingService.completeOnboarding();

      expect(mockSetItemAsync).toHaveBeenCalledWith('onboarding.completed', 'true');
    });

    it('should return false when persistence fails', async () => {
      const { module, mockSetItemAsync } = loadModule();
      mockSetItemAsync.mockRejectedValue(new Error('write failed'));

      await expect(module.onboardingService.completeOnboarding()).resolves.toBe(false);
    });
  });

  describe('resetOnboarding', () => {
    it('should delete onboarding completion flag', async () => {
      const { module, mockDeleteItemAsync } = loadModule();
      mockDeleteItemAsync.mockResolvedValue(undefined);

      await module.onboardingService.resetOnboarding();

      expect(mockDeleteItemAsync).toHaveBeenCalledWith('onboarding.completed');
    });
  });
});
