import { supabase } from '../lib/supabaseClient';
import { clearSupabaseSessionStorage } from '../lib/secureSessionStorage';
import { AuthUser } from '../types';

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

export const getCurrentUserId = async (): Promise<string> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  if (!session?.user?.id) throw new Error('User not authenticated');
  return session.user.id;
};

export const authService = {
  async register(userData: RegisterRequest): Promise<AuthResult> {
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
  },

  async login(credentials: LoginRequest): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Buscar perfil
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
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    await clearSupabaseSessionStorage();
  },

  async getSession(): Promise<{ user: AuthUser | null }> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      throw new Error(error.message);
    }

    if (!session?.user) {
      return { user: null };
    }

    // Buscar perfil
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

  async forgotPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw error;
    }
  },

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message);
    }
  },

  async updateProfile(name: string): Promise<void> {
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
