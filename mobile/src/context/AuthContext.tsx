import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService } from '../services/authService';
import { onboardingService } from '../services/onboardingService';
import { AuthUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  showOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AUTH_TIMEOUT_MS = 4000;
const ONBOARDING_TIMEOUT_FALLBACK = true;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let resolved = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let nextShowOnboardingResolved = false;
    let nextShowOnboardingValue = false;
    const shouldInitializeAuth = Boolean(supabase) && isSupabaseConfigured();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resolve = (authUser: AuthUser | null, nextShowOnboarding: boolean) => {
      if (resolved || !isMounted) return;
      resolved = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setUser(authUser);
      setShowOnboarding(nextShowOnboarding);
      setIsLoading(false);
    };

    timeoutId = setTimeout(() => {
      if (resolved) {
        return;
      }

      if (__DEV__) {
        console.warn('Auth timeout — falling through to login');
      }

      resolve(
        null,
        nextShowOnboardingResolved ? nextShowOnboardingValue : ONBOARDING_TIMEOUT_FALLBACK
      );
    }, AUTH_TIMEOUT_MS);

    const mapSessionUser = (sessionUser: {
      id: string;
      email?: string;
      user_metadata?: { name?: string };
    }): AuthUser => ({
      id: sessionUser.id,
      email: sessionUser.email || '',
      name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || '',
      role: 'user',
    });

    const bootstrap = async () => {
      const onboardingTask = onboardingService
        .hasCompletedOnboarding()
        .then((completed) => !completed)
        .catch((error) => {
          if (__DEV__) {
            console.warn('Onboarding bootstrap failed, showing onboarding as fallback', error);
          }
          return true;
        });

      const authTask = shouldInitializeAuth
        ? authService.getSessionFast()
        : Promise.resolve({ user: null });

      const [onboardingResult, authResult] = await Promise.allSettled([onboardingTask, authTask]);

      const nextShowOnboarding = onboardingResult.status === 'fulfilled'
        ? onboardingResult.value
        : ONBOARDING_TIMEOUT_FALLBACK;

      nextShowOnboardingResolved = true;
      nextShowOnboardingValue = nextShowOnboarding;

      if (!shouldInitializeAuth) {
        if (__DEV__) {
          console.warn('Supabase not configured, skipping auth initialization');
        }
        resolve(null, nextShowOnboarding);
        return;
      }

      if (authResult.status !== 'fulfilled') {
        if (__DEV__) {
          console.error('Initial auth bootstrap failed:', authResult.reason);
        }
        resolve(null, nextShowOnboarding);
        return;
      }

      const initialUser = authResult.value.user;
      resolve(initialUser, nextShowOnboarding);

      if (initialUser) {
        try {
          const { user: fullUser } = await authService.getSession();
          if (isMounted && fullUser) {
            setUser(fullUser);
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Background profile fetch failed:', error);
          }
        }
      }
    };

    subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      if (!resolved) {
        return;
      }

      if (!session?.user) {
        setUser(null);
        return;
      }

      setUser(mapSessionUser(session.user));
    }).data.subscription ?? null;

    void bootstrap();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setUser(response.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await authService.register({ email, password, name });
    if (result.requiresEmailConfirmation) {
      throw new Error('Conta criada! Verifique seu email para confirmar o cadastro antes de entrar.');
    }
    // Auto-login após registro (só quando confirmação de email está desativada no Supabase)
    await login(email, password);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const completeOnboarding = async () => {
    const success = await onboardingService.completeOnboarding();
    if (success) {
      setShowOnboarding(false);
    }
  };

  const updateUser = (updatedUser: AuthUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        showOnboarding,
        login,
        register,
        logout,
        completeOnboarding,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
