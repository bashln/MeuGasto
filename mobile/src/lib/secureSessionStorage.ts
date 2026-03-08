import * as SecureStore from 'expo-secure-store';

export const SUPABASE_SESSION_STORAGE_KEY = 'supabase.auth.token';

export interface SessionStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

const inMemoryStore: Record<string, string> = {};

const createInMemoryStorage = (): SessionStorageAdapter => ({
  getItem: async (key: string) => inMemoryStore[key] || null,
  setItem: async (key: string, value: string) => { inMemoryStore[key] = value; },
  removeItem: async (key: string) => { delete inMemoryStore[key]; },
});

let useInMemory = false;

const getItem = async (key: string): Promise<string | null> => {
  if (useInMemory) {
    return inMemoryStore[key] || null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn('[SecureSessionStorage] SecureStore getItem failed, using in-memory:', error);
    useInMemory = true;
    return inMemoryStore[key] || null;
  }
};

const setItem = async (key: string, value: string): Promise<void> => {
  if (useInMemory) {
    inMemoryStore[key] = value;
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn('[SecureSessionStorage] SecureStore setItem failed, using in-memory:', error);
    useInMemory = true;
    inMemoryStore[key] = value;
  }
};

const removeItem = async (key: string): Promise<void> => {
  if (useInMemory) {
    delete inMemoryStore[key];
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn('[SecureSessionStorage] SecureStore removeItem failed, using in-memory:', error);
    useInMemory = true;
    delete inMemoryStore[key];
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
