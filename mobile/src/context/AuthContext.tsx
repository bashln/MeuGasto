import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { authService } from '../services/authService';
import { AuthUser } from '../types';
import { supabase } from '../lib/supabaseClient';

SplashScreen.preventAutoHideAsync();

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    let isMounted = true;
    let resolved = false;

    const resolve = (authUser: AuthUser | null) => {
      if (resolved || !isMounted) return;
      resolved = true;
      setUser(authUser);
      setIsLoading(false);
      SplashScreen.hideAsync();
    };

    const timeoutId = setTimeout(() => {
      console.warn('Auth timeout — falling through to login');
      resolve(null);
    }, AUTH_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        resolve(null);
        return;
      }

      // Immediately set user from session (no network call)
      const sessionUser: AuthUser = {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
        role: 'USER',
      };
      resolve(sessionUser);

      // Background: fetch full profile and update seamlessly
      try {
        const { user: fullUser } = await authService.getSession();
        if (isMounted && fullUser) {
          setUser(fullUser);
        }
      } catch (error) {
        console.error('Background profile fetch failed:', error);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authService.login({ email, password });
    setUser(response.user);
  };

  const register = async (email: string, password: string, name: string) => {
    await authService.register({ email, password, name });
    // Auto-login após registro
    await login(email, password);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
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
        login,
        register,
        logout,
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
