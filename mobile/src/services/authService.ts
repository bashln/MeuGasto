import {
  getResolvedSupabaseConfig,
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseUrl,
} from '../lib/supabaseClient';
import { clearSupabaseSessionStorage } from '../lib/secureSessionStorage';
import { AuthUser } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface AuthResult {
  user: AuthUser;
  requiresEmailConfirmation?: boolean;
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

const getConfiguredAuthRedirectUrl = (): string | undefined => {
  const rawValue = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(rawValue);
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('redirect_must_use_https');
    }

    return parsedUrl.toString();
  } catch (error) {
    if (__DEV__) {
      console.warn('[Auth] Ignoring invalid EXPO_PUBLIC_AUTH_REDIRECT_URL; expected https:// URL', error);
    }

    return undefined;
  }
};

const getSupabaseConfigurationErrorMessage = (): string => {
  const config = getResolvedSupabaseConfig();

  switch (config.error) {
    case 'missing_url':
      return 'Configuração do Supabase ausente. EXPO_PUBLIC_SUPABASE_URL não foi definida no app.';
    case 'missing_key':
      return 'Configuração do Supabase ausente. EXPO_PUBLIC_SUPABASE_ANON_KEY não foi definida no app.';
    case 'invalid_url':
      return 'Configuração inválida do Supabase. Verifique se a URL usa https:// e aponta para o projeto correto.';
    default:
      return 'Configuração do Supabase ausente. Verifique as variáveis de ambiente EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  }
};

const getPreferredUserName = (options: {
  profileName?: string | null;
  metadataName?: string | null;
  email?: string | null;
}): string => {
  const profileName = options.profileName?.trim();
  if (profileName) {
    return profileName;
  }

  const metadataName = options.metadataName?.trim();
  if (metadataName) {
    return metadataName;
  }

  return options.email?.split('@')[0] || '';
};

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(getSupabaseConfigurationErrorMessage());
  }
  return client;
};

const normalizeAuthError = (error: unknown, action: 'login' | 'register'): Error => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes(NON_JSON_RESPONSE_ERROR)) {
    if (__DEV__) {
      const config = getResolvedSupabaseConfig();
      console.error(`Supabase ${action} returned non-JSON response`, {
        config: {
          source: config.source,
          error: config.error,
          url: config.url ? 'defined' : 'undefined',
          anonKey: config.anonKey ? 'defined' : 'undefined',
        },
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
      throw new Error(getSupabaseConfigurationErrorMessage());
    }

    const supabase = getClient();

    try {
      const authRedirectUrl = getConfiguredAuthRedirectUrl();
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
          },
          ...(authRedirectUrl ? { emailRedirectTo: authRedirectUrl } : {}),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        user: {
          id: data.user?.id ?? '',
          email: data.user?.email || userData.email,
          name: userData.name,
          role: 'user',
        },
        requiresEmailConfirmation: !data.session,
      };
    } catch (error) {
      throw normalizeAuthError(error, 'register');
    }
  },

  async login(credentials: LoginRequest): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      throw new Error(getSupabaseConfigurationErrorMessage());
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

      let userName = getPreferredUserName({
        metadataName: data.user?.user_metadata?.name,
        email: data.user?.email || credentials.email,
      });

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', data.user.id)
          .single();

        userName = getPreferredUserName({
          profileName: profile?.name,
          metadataName: data.user.user_metadata?.name,
          email: data.user.email,
        });
      }

      return {
        user: {
          id: data.user?.id ?? '',
          email: data.user?.email || credentials.email,
          name: userName,
          role: 'user',
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
        name: getPreferredUserName({
          profileName: profile?.name,
          metadataName: session.user.user_metadata?.name,
          email: session.user.email,
        }),
        role: profile?.role || 'user',
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
        role: 'user',
      },
    };
  },

  async forgotPassword(email: string): Promise<void> {
    const supabase = getClient();
    const authRedirectUrl = getConfiguredAuthRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      authRedirectUrl ? { redirectTo: authRedirectUrl } : undefined,
    );
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
