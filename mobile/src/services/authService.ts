import { getSupabaseClient, isSupabaseConfigured, supabaseUrl } from '../lib/supabaseClient';
import { clearSupabaseSessionStorage } from '../lib/secureSessionStorage';
import { AuthUser } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface AuthResult {
  user: AuthUser;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

const NON_JSON_RESPONSE_ERROR = 'JSON Parse error: Unexpected character: <';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      'Configuração do Supabase ausente. Verifique as variáveis de ambiente EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return client;
};

const normalizeAuthError = (error: unknown, action: 'login' | 'register'): Error => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes(NON_JSON_RESPONSE_ERROR)) {
    if (__DEV__) {
      console.error(`Supabase ${action} returned non-JSON response`, {
        supabaseUrl,
        authEndpoint: `${supabaseUrl}/auth/v1/token?grant_type=password`,
        hint: 'Check EXPO_PUBLIC_SUPABASE_URL and whether the Android build is using the latest env values.',
      });
    }

    return new Error(
      'Falha de configuracao do servidor de autenticacao. Verifique a URL do Supabase no app Android.'
    );
  }

  return error instanceof Error ? error : new Error(message);
};

export const getCurrentUserId = async (): Promise<string> => {
  const supabase = getClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!session?.user?.id) throw new Error('User not authenticated');
  return session.user.id;
};

export const authService = {
  async register(userData: RegisterRequest): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Configuração do Supabase ausente. Verifique as variáveis de ambiente no aplicativo.'
      );
    }

    const supabase = getClient();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name: userData.name,
          role: 'USER',
        });
      }

      return {
        user: {
          id: data.user?.id ?? '',
          email: data.user?.email || userData.email,
          name: userData.name,
          role: 'USER',
        },
      };
    } catch (error) {
      throw normalizeAuthError(error, 'register');
    }
  },

  async login(credentials: LoginRequest): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Configuração do Supabase ausente. Verifique as variáveis de ambiente no aplicativo.'
      );
    }

    const supabase = getClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      let userName = credentials.email.split('@')[0];

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.user.id)
          .single();

        if (profile?.name) {
          userName = profile.name;
        } else {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            name: userName,
            role: 'USER',
          });
        }
      }

      return {
        user: {
          id: data.user?.id ?? '',
          email: data.user?.email || credentials.email,
          name: userName,
          role: 'USER',
        },
      };
    } catch (error) {
      throw normalizeAuthError(error, 'login');
    }
  },

  async logout(): Promise<void> {
    const supabase = getClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    await clearSupabaseSessionStorage();
  },

  async getSession(): Promise<{ user: AuthUser | null }> {
    const supabase = getClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(error.message);
    }

    if (!session?.user) {
      return { user: null };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    return {
      user: {
        id: session.user.id,
        email: session.user.email || '',
        name: profile?.name || session.user.email?.split('@')[0] || '',
        role: profile?.role || 'USER',
      },
    };
  },

  async getSessionFast(): Promise<{ user: AuthUser | null }> {
    const supabase = getClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return { user: null };
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
        role: 'USER',
      },
    };
  },

  async forgotPassword(email: string): Promise<void> {
    const supabase = getClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  },

  async changePassword(newPassword: string): Promise<void> {
    const supabase = getClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message);
    }
  },

  async updateProfile(name: string): Promise<void> {
    const supabase = getClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error(userError?.message || 'Usuário não autenticado');
    }
    const { error } = await supabase.from('profiles').update({ name }).eq('id', user.id);
    if (error) {
      throw new Error(error.message);
    }
  },
};

export const checkSupabaseConfiguration = (): { configured: boolean; message: string } => {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      message: 'Configuração do Supabase ausente. Verifique as variáveis de ambiente no aplicativo.',
    };
  }
  return {
    configured: true,
    message: 'Supabase configurado corretamente.',
  };
};
