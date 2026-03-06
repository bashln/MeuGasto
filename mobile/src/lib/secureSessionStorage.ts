import * as SecureStore from 'expo-secure-store';

export const SUPABASE_SESSION_STORAGE_KEY = 'supabase.auth.token';

export interface SessionStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const getItem = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    throw new Error(`Failed to read secure storage key "${key}": ${String(error)}`);
  }
};

const setItem = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    throw new Error(`Failed to write secure storage key "${key}": ${String(error)}`);
  }
};

const removeItem = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    throw new Error(`Failed to remove secure storage key "${key}": ${String(error)}`);
  }
};

export const secureSessionStorage: SessionStorageAdapter = {
  getItem,
  setItem,
  removeItem,
};

export const clearSupabaseSessionStorage = async (): Promise<void> => {
  await secureSessionStorage.removeItem(SUPABASE_SESSION_STORAGE_KEY);
};
