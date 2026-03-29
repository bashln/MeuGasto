import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { purchaseService } from '../services';
import { Purchase, PurchaseFilter, PageResponse } from '../types';
import { usePagination } from '../hooks/usePagination';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface PurchaseContextType {
  purchases: Purchase[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  page: PageResponse<Purchase>['page'] | null;
  fetchPurchases: (filter?: PurchaseFilter) => Promise<void>;
  loadMorePurchases: (filter?: PurchaseFilter) => Promise<void>;
  getPurchase: (id: number) => Promise<Purchase>;
  updatePurchase: (id: number, data: Partial<{ date: string; totalPrice: number; supermarketId: number | null }>) => Promise<Purchase>;
  deletePurchase: (id: number) => Promise<void>;
  updatePurchaseItems: (id: number, items: Array<{ id?: number; name: string; quantity: number; unit: string; price: number }>) => Promise<Purchase>;
  isOnline: boolean;
  isSyncing: boolean;
  isFromCache: boolean; // Indica se dados são do cache offline
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

interface PurchaseProviderProps {
  children: React.ReactNode;
}

const PAGE_SIZE = 20;

export const PurchaseProvider: React.FC<PurchaseProviderProps> = ({ children }) => {
  const [paginationState, paginationActions] = usePagination<Purchase>(PAGE_SIZE);
  const offlineSync = useOfflineSync();
  const [isFromCache, setIsFromCache] = useState(false);

  // Carrega cache offline na inicialização
  useEffect(() => {
    const loadOfflineCache = async () => {
      const cached = await offlineSync.getCachedPurchases();
      if (cached && cached.length > 0) {
        // Preenche com dados cacheados primeiro
        paginationActions.reset();
        cached.forEach(purchase => paginationActions.addItem(purchase));
        setIsFromCache(true);
      }
    };
    
    loadOfflineCache();
  }, []);

  // Cacheia quando recebe novos dados
  useEffect(() => {
    if (paginationState.data.length > 0 && !paginationState.isLoading) {
      offlineSync.cachePurchases(paginationState.data);
      // Marca que não é mais do cache quando tem dados atualizados
      if (isFromCache && !offlineSync.isOnline) {
        setIsFromCache(false);
      }
    }
  }, [paginationState.data, paginationState.isLoading, offlineSync.isOnline]);

  const fetchPurchases = useCallback(async (filter?: PurchaseFilter) => {
    const page = filter?.page ?? 0;
    
    // Se estiver offline, não mostra erro
    if (!offlineSync.isOnline) {
      // Mantém dados cacheados
      return;
    }
    
    await paginationActions.fetchData(
      async (p, size) => {
        const response = await purchaseService.getPurchases({
          ...filter,
          page: p,
          size,
        });
        return response;
      },
      page
    );
  }, [paginationActions, offlineSync.isOnline]);

  const loadMorePurchases = useCallback(async (filter?: PurchaseFilter) => {
    if (paginationState.isLoadingMore || !paginationState.hasMore) {
      return;
    }

    const nextPage = (paginationState.page?.pageNumber ?? 0) + 1;
    await fetchPurchases({ ...filter, page: nextPage });
  }, [fetchPurchases, paginationState.hasMore, paginationState.isLoadingMore, paginationState.page?.pageNumber]);

  const getPurchase = useCallback(async (id: number): Promise<Purchase> => {
    return purchaseService.getPurchaseById(id);
  }, []);

  const updatePurchase = useCallback(async (
    id: number,
    data: Partial<{ date: string; totalPrice: number; supermarketId: number | null }>
  ): Promise<Purchase> => {
    const previousPurchase = paginationState.data.find(p => p.id === id);
    
    if (previousPurchase) {
      paginationActions.updateItem(id, (purchase) => ({
        ...purchase,
        ...data,
        date: data.date ?? purchase.date,
        totalPrice: data.totalPrice ?? purchase.totalPrice,
        supermarket: data.supermarketId !== null && data.supermarketId !== undefined
          ? { ...purchase.supermarket, id: data.supermarketId }
          : purchase.supermarket,
      }));
    }

    try {
      const purchase = await purchaseService.updatePurchase(id, data);
      paginationActions.updateItem(id, () => purchase);
      return purchase;
    } catch (error) {
      if (previousPurchase) {
        paginationActions.updateItem(id, () => previousPurchase);
      }
      
      // Se falhar por falta de conexão, adiciona à fila offline
      if (!offlineSync.isOnline) {
        await offlineSync.queueOperation({
          type: 'update',
          entity: 'purchase',
          data: { id, ...data },
        });
      }
      
      throw error;
    }
  }, [paginationActions, paginationState.data, offlineSync]);

  const deletePurchase = useCallback(async (id: number): Promise<void> => {
    paginationActions.removeItem(id, (purchase) => purchase.id);

    try {
      await purchaseService.deletePurchase(id);
    } catch (error) {
      if (!offlineSync.isOnline) {
        await offlineSync.queueOperation({
          type: 'delete',
          entity: 'purchase',
          data: { id },
        });
      } else {
        if (__DEV__) {
          console.warn('[PurchaseContext] Erro ao deletar:', error);
        }
        throw error;
      }
    }
  }, [paginationActions, offlineSync]);

  const updatePurchaseItems = useCallback(async (
    id: number,
    items: Array<{ id?: number; name: string; quantity: number; unit: string; price: number }>
  ): Promise<Purchase> => {
    const newTotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    paginationActions.updateItem(id, (purchase) => ({
      ...purchase,
      products: items.map((item, index) => ({
        id: item.id || -(index + 1),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        code: undefined,
      })),
      totalPrice: newTotal,
    }));

    try {
      const purchase = await purchaseService.updatePurchaseItems(id, items);
      paginationActions.updateItem(id, () => purchase);
      return purchase;
    } catch (error) {
      if (__DEV__) {
        console.warn('[PurchaseContext] Erro ao atualizar items, recarregando:', error);
      }
      try {
        const refreshedPurchase = await purchaseService.getPurchaseById(id);
        paginationActions.updateItem(id, () => refreshedPurchase);
      } catch (refreshError) {
        if (__DEV__) {
          console.error('[PurchaseContext] Falha ao recarregar:', refreshError);
        }
      }
      throw error;
    }
  }, [paginationActions]);

  return (
    <PurchaseContext.Provider
      value={{
        purchases: paginationState.data,
        isLoading: paginationState.isLoading,
        isLoadingMore: paginationState.isLoadingMore,
        hasMore: paginationState.hasMore,
        error: paginationState.error,
        page: paginationState.page,
        fetchPurchases,
        loadMorePurchases,
        getPurchase,
        updatePurchase,
        deletePurchase,
        updatePurchaseItems,
        isOnline: offlineSync.isOnline,
        isSyncing: offlineSync.isSyncing,
        isFromCache,
      }}
    >
      {children}
    </PurchaseContext.Provider>
  );
};

export const usePurchases = (): PurchaseContextType => {
  const context = useContext(PurchaseContext);
  if (context === undefined) {
    throw new Error('usePurchases must be used within a PurchaseProvider');
  }
  return context;
};
