import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { authService } from '../services/authService';
import { onboardingService } from '../services/onboardingService';
import { AuthUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

void SplashScreen.preventAutoHideAsync().catch(() => {});

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

const AUTH_TIMEOUT_MS = 8000;

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

    const resolve = (authUser: AuthUser | null, nextShowOnboarding: boolean) => {
      if (resolved || !isMounted) return;
      resolved = true;
      setUser(authUser);
      setShowOnboarding(nextShowOnboarding);
      setIsLoading(false);
      void SplashScreen.hideAsync().catch(() => {});
    };

    const timeoutId = setTimeout(() => {
      if (__DEV__) {
        console.warn('Auth timeout — falling through to login');
      }
      if (!resolved) {
        resolve(null, nextShowOnboardingResolved ? nextShowOnboardingValue : false);
      }
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
      let nextShowOnboarding = false;

      try {
        const completed = await onboardingService.hasCompletedOnboarding();
        nextShowOnboarding = !completed;
      } catch (error) {
        if (__DEV__) {
          console.warn('Onboarding bootstrap failed, hiding onboarding as fallback', error);
        }
        nextShowOnboarding = true;
      }

      nextShowOnboardingResolved = true;
      nextShowOnboardingValue = nextShowOnboarding;

      if (!supabase || !isSupabaseConfigured()) {
        if (__DEV__) {
          console.warn('Supabase not configured, skipping auth initialization');
        }
        resolve(null, nextShowOnboarding);
        return;
      }

      try {
        const { user: initialUser } = await authService.getSessionFast();
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
      } catch (error) {
        if (__DEV__) {
          console.error('Initial auth bootstrap failed:', error);
        }
        resolve(null, nextShowOnboarding);
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
      clearTimeout(timeoutId);
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
