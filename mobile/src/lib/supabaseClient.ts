import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secureSessionStorage, SUPABASE_SESSION_STORAGE_KEY } from './secureSessionStorage';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (__DEV__) {
      console.error('[SupabaseClient] Configuration missing:', {
        url: supabaseUrl ? 'defined' : 'undefined',
        key: supabaseAnonKey ? 'defined' : 'undefined',
      });
    }
    return false;
  }
  return true;
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: secureSessionStorage,
        storageKey: SUPABASE_SESSION_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    if (__DEV__) {
      console.error('[SupabaseClient] Failed to create client:', error);
    }
    return null;
  }
};

export const supabase = getSupabaseClient();
