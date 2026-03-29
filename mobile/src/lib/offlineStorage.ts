import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'purchase' | 'draft';
  data: unknown;
  timestamp: number;
  retryCount: number;
}

const OFFLINE_QUEUE_KEY = 'meugasto_offline_queue';
const OFFLINE_DATA_KEY = 'meugasto_offline_data';
const MAX_QUEUE_SIZE = 100; // Limite para evitar estourar AsyncStorage (6MB limit)

/**
 * Adiciona uma operação à fila offline
 */
export const addToOfflineQueue = async (item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    
    // Verifica limite da fila
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Remove itens mais antigos (primeiros 10) para fazer espaço
      queue.splice(0, 10);
      if (__DEV__) {
        console.warn('[OfflineQueue] Fila cheia, removendo 10 itens mais antigos');
      }
    }
    
    const newItem: OfflineQueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    queue.push(newItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    if (__DEV__) {
      console.log('[OfflineQueue] Operação adicionada:', newItem.type, newItem.entity);
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineQueue] Erro ao adicionar à fila:', error);
    }
    throw error;
  }
};

/**
 * Recupera a fila de operações offline
 */
export const getOfflineQueue = async (): Promise<OfflineQueueItem[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineQueue] Erro ao recuperar fila:', error);
    }
    return [];
  }
};

/**
 * Remove uma operação da fila
 */
export const removeFromOfflineQueue = async (id: string): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineQueue] Erro ao remover da fila:', error);
    }
  }
};

/**
 * Incrementa contador de retry
 */
export const incrementRetryCount = async (id: string): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const item = queue.find(i => i.id === id);
    if (item) {
      item.retryCount++;
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineQueue] Erro ao incrementar retry:', error);
    }
  }
};

/**
 * Limpa a fila offline
 */
export const clearOfflineQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    if (__DEV__) {
      console.log('[OfflineQueue] Fila limpa');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineQueue] Erro ao limpar fila:', error);
    }
  }
};

/**
 * Cacheia dados para exibição offline
 */
export const cacheData = async <T>(key: string, data: T): Promise<void> => {
  try {
    const cacheKey = `${OFFLINE_DATA_KEY}_${key}`;
    const cacheItem = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheItem));
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineCache] Erro ao cachear:', error);
    }
  }
};

/**
 * Recupera dados cacheados
 */
export const getCachedData = async <T>(key: string, maxAge: number = 24 * 60 * 60 * 1000): Promise<T | null> => {
  try {
    const cacheKey = `${OFFLINE_DATA_KEY}_${key}`;
    const data = await AsyncStorage.getItem(cacheKey);
    
    if (!data) return null;
    
    const cacheItem = JSON.parse(data) as { data: T; timestamp: number };
    const age = Date.now() - cacheItem.timestamp;
    
    // Retorna null se cache expirou
    if (age > maxAge) {
      await AsyncStorage.removeItem(cacheKey);
      return null;
    }
    
    return cacheItem.data;
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineCache] Erro ao recuperar cache:', error);
    }
    return null;
  }
};

/**
 * Limpa cache antigo
 */
export const clearOldCache = async (maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(OFFLINE_DATA_KEY));
    
    for (const key of cacheKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const cacheItem = JSON.parse(data) as { timestamp: number };
        const age = Date.now() - cacheItem.timestamp;
        if (age > maxAge) {
          await AsyncStorage.removeItem(key);
        }
      }
    }
    
    if (__DEV__) {
      console.log('[OfflineCache] Cache antigo limpo');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[OfflineCache] Erro ao limpar cache:', error);
    }
  }
};
