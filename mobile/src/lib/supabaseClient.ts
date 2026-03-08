import Constants from 'expo-constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { secureSessionStorage, SUPABASE_SESSION_STORAGE_KEY } from './secureSessionStorage';

type SupabaseConfigSource = 'process.env' | 'expo.extra' | 'missing';
type SupabaseConfigError = 'missing_url' | 'missing_key' | 'invalid_url' | null;

interface SupabaseExtraConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface ResolvedSupabaseConfig {
  url: string | null;
  anonKey: string | null;
  source: SupabaseConfigSource;
  error: SupabaseConfigError;
}

const getNormalizedValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  return normalized;
};

const getExpoExtra = (): SupabaseExtraConfig => {
  const extra = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') {
    return {};
  }
  return extra as SupabaseExtraConfig;
};

const isValidSupabaseUrl = (value: string): boolean => {
  if (!value.startsWith('https://')) {
    return false;
  }

  if (value.includes('"') || value.includes("'") || value.includes('<') || value.includes('>')) {
    return false;
  }

  try {
    const url = new URL(value);
    return Boolean(url.hostname) && Boolean(url.protocol === 'https:');
  } catch {
    return false;
  }
};

export const getResolvedSupabaseConfig = (): ResolvedSupabaseConfig => {
  const extra = getExpoExtra();
  const envUrl = getNormalizedValue(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const envAnonKey = getNormalizedValue(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  const extraUrl = getNormalizedValue(extra.supabaseUrl);
  const extraAnonKey = getNormalizedValue(extra.supabaseAnonKey);

  const source: SupabaseConfigSource = envUrl || envAnonKey
    ? 'process.env'
    : extraUrl || extraAnonKey
      ? 'expo.extra'
      : 'missing';

  const url = envUrl ?? extraUrl;
  const anonKey = envAnonKey ?? extraAnonKey;

  if (!url) {
    return { url: null, anonKey, source, error: 'missing_url' };
  }

  if (!anonKey) {
    return { url, anonKey: null, source, error: 'missing_key' };
  }

  if (!isValidSupabaseUrl(url)) {
    return { url, anonKey, source, error: 'invalid_url' };
  }

  return { url, anonKey, source, error: null };
};

export const supabaseUrl = getResolvedSupabaseConfig().url;

export const isSupabaseConfigured = (): boolean => {
  const config = getResolvedSupabaseConfig();
  if (!config.error) {
    return true;
  }

  if (__DEV__) {
    console.error('[SupabaseClient] Configuration invalid:', {
      source: config.source,
      error: config.error,
      url: config.url ? 'defined' : 'undefined',
      key: config.anonKey ? 'defined' : 'undefined',
    });
  }

  return false;
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const config = getResolvedSupabaseConfig();
  if (config.error || !config.url || !config.anonKey) {
    return null;
  }

  try {
    return createClient(config.url, config.anonKey, {
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
      console.error('[SupabaseClient] Failed to create client:', {
        error,
        source: config.source,
      });
    }
    return null;
  }
};

export const supabase = getSupabaseClient();
