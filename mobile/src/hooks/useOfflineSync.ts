import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import {
  OfflineQueueItem,
  getOfflineQueue,
  removeFromOfflineQueue,
  incrementRetryCount,
  cacheData,
  getCachedData,
} from '../lib/offlineStorage';
import { purchaseService } from '../services/purchaseService';
import { draftService } from '../services/draftService';
import { Purchase, Draft } from '../types';

interface UseOfflineSyncResult {
  isOnline: boolean;
  isSyncing: boolean;
  queueSize: number;
  sync: () => Promise<void>;
  queueOperation: (operation: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  cachePurchases: (purchases: Purchase[]) => Promise<void>;
  cacheDrafts: (drafts: Draft[]) => Promise<void>;
  getCachedPurchases: () => Promise<Purchase[] | null>;
  getCachedDrafts: () => Promise<Draft[] | null>;
}

const MAX_RETRY_ATTEMPTS = 3;

export function useOfflineSync(): UseOfflineSyncResult {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const prevOnlineStatus = useRef(true);

  // Monitora conectividade
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      setIsOnline(isConnected);
      
      // Quando volta online, tenta sincronizar
      if (isConnected && !prevOnlineStatus.current) {
        sync();
      }
      
      prevOnlineStatus.current = isConnected;
    });

    // Atualiza tamanho da fila periodicamente
    const interval = setInterval(() => {
      updateQueueSize();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Atualiza tamanho da fila com tratamento de erro
  const updateQueueSize = useCallback(async () => {
    try {
      const queue = await getOfflineQueue();
      setQueueSize(queue.length);
    } catch (error) {
      if (__DEV__) {
        console.error('[OfflineSync] Erro ao atualizar tamanho da fila:', error);
      }
    }
  }, []);

  const sync = useCallback(async () => {
    if (isSyncing) return;
    
    const queue = await getOfflineQueue();
    if (queue.length === 0) return;
    
    setIsSyncing(true);
    
    try {
      for (const item of queue) {
        if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
          await removeFromOfflineQueue(item.id);
          if (__DEV__) {
            console.warn('[OfflineSync] Operação excedeu tentativas:', item);
          }
          continue;
        }

        try {
          await processOfflineOperation(item);
          await removeFromOfflineQueue(item.id);
          if (__DEV__) {
            console.log('[OfflineSync] Operação sincronizada:', item.type, item.entity);
          }
        } catch (error) {
          await incrementRetryCount(item.id);
          if (__DEV__) {
            console.error('[OfflineSync] Erro ao sincronizar:', error);
          }
        }
      }
    } finally {
      setIsSyncing(false);
      await updateQueueSize();
    }
  }, [isSyncing, updateQueueSize]);

  // Processamento de operações - definido antes do sync para evitar dependência circular
  const processOfflineOperation = useCallback(async (item: OfflineQueueItem) => {
    switch (item.entity) {
      case 'purchase':
        await processPurchaseOperation(item);
        break;
      case 'draft':
        await processDraftOperation(item);
        break;
    }
  }, []);

  const processPurchaseOperation = async (item: OfflineQueueItem) => {
    const data = item.data as { 
      id?: number;
      date?: string;
      totalPrice?: number;
      supermarketId?: number | null;
    };
    
    switch (item.type) {
      case 'create':
        // Não podemos criar purchase offline (precisa de NFC-e ou dados complexos)
        break;
      case 'update':
        if (data.id) {
          await purchaseService.updatePurchase(data.id, {
            date: data.date,
            totalPrice: data.totalPrice,
            supermarketId: data.supermarketId,
          });
        }
        break;
      case 'delete':
        if (data.id) {
          await purchaseService.deletePurchase(data.id);
        }
        break;
    }
  };

  const processDraftOperation = async (item: OfflineQueueItem) => {
    const data = item.data as { 
      id?: number;
      supermarketId?: number;
      content: string;
      items: Array<{ name: string; quantity: number; unit: string; price: number }>;
    };
    
    switch (item.type) {
      case 'create':
        await draftService.createDraft({
          supermarketId: data.supermarketId,
          content: data.content,
          items: data.items,
        });
        break;
      case 'update':
        if (data.id) {
          await draftService.updateDraft(data.id, {
            supermarketId: data.supermarketId,
            content: data.content,
            items: data.items,
          });
        }
        break;
      case 'delete':
        if (data.id) {
          await draftService.deleteDraft(data.id);
        }
        break;
    }
  };

  // Monitora conectividade
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      setIsOnline(isConnected);
      
      // Quando volta online, tenta sincronizar
      if (isConnected && !prevOnlineStatus.current) {
        sync();
      }
      
      prevOnlineStatus.current = isConnected;
    });

    // Atualiza tamanho da fila periodicamente
    const interval = setInterval(() => {
      updateQueueSize();
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [sync, updateQueueSize]);

  const queueOperation = useCallback(async (
    operation: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>
  ) => {
    // Se estiver online, executa imediatamente
    if (isOnline) {
      try {
        await processOfflineOperation({
          ...operation,
          id: 'temp',
          timestamp: Date.now(),
          retryCount: 0,
        });
        return;
      } catch (error) {
        // Se falhar, adiciona à fila
        if (__DEV__) {
          console.warn('[OfflineSync] Operação falhou, adicionando à fila:', error);
        }
      }
    }
    
    // Adiciona à fila offline
    const { addToOfflineQueue } = await import('../lib/offlineStorage');
    await addToOfflineQueue(operation);
    await updateQueueSize();
  }, [isOnline, processOfflineOperation, updateQueueSize]);

  const cachePurchases = useCallback(async (purchases: Purchase[]) => {
    await cacheData('purchases', purchases);
  }, []);

  const cacheDrafts = useCallback(async (drafts: Draft[]) => {
    await cacheData('drafts', drafts);
  }, []);

  const getCachedPurchases = useCallback(async () => {
    return getCachedData<Purchase[]>('purchases');
  }, []);

  const getCachedDrafts = useCallback(async () => {
    return getCachedData<Draft[]>('drafts');
  }, []);

  return {
    isOnline,
    isSyncing,
    queueSize,
    sync,
    queueOperation,
    cachePurchases,
    cacheDrafts,
    getCachedPurchases,
    getCachedDrafts,
  };
}
