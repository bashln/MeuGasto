import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secureSessionStorage, SUPABASE_SESSION_STORAGE_KEY } from './secureSessionStorage';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[SupabaseClient] Configuration missing:', {
      url: supabaseUrl ? 'defined' : 'undefined',
      key: supabaseAnonKey ? 'defined' : 'undefined',
    });
    return false;
  }
  return true;
};

const createInMemoryStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: async (key: string) => store[key] || null,
    setItem: async (key: string, value: string) => { store[key] = value; },
    removeItem: async (key: string) => { delete store[key]; },
  };
};

export const getSupabaseClient: () => SupabaseClient | null = () => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  let storage = secureSessionStorage;
  
  try {
    const testKey = '__test_secure_store__';
    secureSessionStorage.setItem(testKey, 'test').catch(() => {
      console.warn('[SupabaseClient] SecureStore not available, using in-memory storage');
      storage = createInMemoryStorage();
    });
  } catch {
    storage = createInMemoryStorage();
  }

  try {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage,
        storageKey: SUPABASE_SESSION_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('[SupabaseClient] Failed to create client:', error);
    return null;
  }
};

export const supabase = getSupabaseClient();
