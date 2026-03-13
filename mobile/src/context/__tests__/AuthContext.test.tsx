jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/authService', () => ({
  authService: {
    getSession: jest.fn(),
    getSessionFast: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
  },
}));

jest.mock('../../services/onboardingService', () => ({
  onboardingService: {
    hasCompletedOnboarding: jest.fn(),
    completeOnboarding: jest.fn(),
  },
}));

jest.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(),
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(),
    },
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/authService';
import { onboardingService } from '../../services/onboardingService';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type Snapshot = {
  isLoading: boolean;
  isAuthenticated: boolean;
  showOnboarding: boolean;
};

const mockGetSession = authService.getSession as jest.Mock;
const mockGetSessionFast = authService.getSessionFast as jest.Mock;
const mockHasCompletedOnboarding = onboardingService.hasCompletedOnboarding as jest.Mock;
const mockCompleteOnboarding = onboardingService.completeOnboarding as jest.Mock;
const mockIsSupabaseConfigured = isSupabaseConfigured as jest.Mock;
const mockOnAuthStateChange = supabase!.auth.onAuthStateChange as jest.Mock;
const mockHideAsync = SplashScreen.hideAsync as jest.Mock;

const Consumer = ({ onRender }: { onRender: (value: Snapshot & { completeOnboarding: () => Promise<void> }) => void }) => {
  const auth = useAuth();
  onRender({
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    showOnboarding: auth.showOnboarding,
    completeOnboarding: auth.completeOnboarding,
  });
  return null;
};

describe('AuthContext', () => {
  let renderer: { unmount: () => void } | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    });
    mockGetSession.mockResolvedValue({ user: null });
  });

  afterEach(async () => {
    if (renderer) {
      await act(async () => {
        renderer?.unmount();
      });
      renderer = null;
    }
    jest.restoreAllMocks();
  });

  it('resolves bootstrap with onboarding hidden when already completed', async () => {
    const snapshots: Snapshot[] = [];
    mockHasCompletedOnboarding.mockResolvedValue(true);
    mockGetSessionFast.mockResolvedValue({ user: null });

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthProvider>
          <Consumer onRender={(value) => snapshots.push(value)} />
        </AuthProvider>
      );
    });

    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(lastSnapshot).toMatchObject({
      isLoading: false,
      isAuthenticated: false,
      showOnboarding: false,
    });
    expect(mockHideAsync).toHaveBeenCalled();
  });

  it('resolves bootstrap with onboarding visible when pending', async () => {
    const snapshots: Snapshot[] = [];
    mockHasCompletedOnboarding.mockResolvedValue(false);
    mockGetSessionFast.mockResolvedValue({ user: null });

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthProvider>
          <Consumer onRender={(value) => snapshots.push(value)} />
        </AuthProvider>
      );
    });

    expect(snapshots[snapshots.length - 1]).toMatchObject({
      isLoading: false,
      showOnboarding: true,
    });
  });

  it('falls back safely when onboarding read fails', async () => {
    const snapshots: Snapshot[] = [];
    mockHasCompletedOnboarding.mockRejectedValue(new Error('secure store error'));
    mockGetSessionFast.mockResolvedValue({ user: null });

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthProvider>
          <Consumer onRender={(value) => snapshots.push(value)} />
        </AuthProvider>
      );
    });

    expect(snapshots[snapshots.length - 1]).toMatchObject({
      isLoading: false,
      showOnboarding: true,
    });
    expect(mockHideAsync).toHaveBeenCalled();
  });

  it('updates in-memory onboarding state when completed', async () => {
    const snapshots: Array<Snapshot & { completeOnboarding: () => Promise<void> }> = [];
    mockHasCompletedOnboarding.mockResolvedValue(false);
    mockGetSessionFast.mockResolvedValue({ user: null });
    mockCompleteOnboarding.mockResolvedValue(true);

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthProvider>
          <Consumer onRender={(value) => snapshots.push(value)} />
        </AuthProvider>
      );
    });

    const latest = snapshots[snapshots.length - 1];

    await act(async () => {
      await latest.completeOnboarding();
    });

    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(snapshots[snapshots.length - 1]).toMatchObject({
      showOnboarding: false,
    });
  });

  it('finishes bootstrap on timeout when auth hangs after onboarding is resolved', async () => {
    const snapshots: Snapshot[] = [];
    jest.useFakeTimers();
    mockHasCompletedOnboarding.mockResolvedValue(false);
    mockGetSessionFast.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      renderer = TestRenderer.create(
        <AuthProvider>
          <Consumer onRender={(value) => snapshots.push(value)} />
        </AuthProvider>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(8000);
    });

    expect(snapshots[snapshots.length - 1]).toMatchObject({
      isLoading: false,
      isAuthenticated: false,
      showOnboarding: true,
    });
    expect(mockHideAsync).toHaveBeenCalled();
  });
});
