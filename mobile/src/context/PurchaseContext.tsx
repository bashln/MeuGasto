import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { purchaseService } from '../services';
import { Purchase, PurchaseFilter, PageResponse, NfceRequest } from '../types';

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
  createPurchase: (data: NfceRequest) => Promise<Purchase>;
  updatePurchase: (id: number, data: Partial<{ date: string; totalPrice: number; supermarketId: number | null }>) => Promise<Purchase>;
  deletePurchase: (id: number) => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

interface PurchaseProviderProps {
  children: ReactNode;
}

export const PurchaseProvider: React.FC<PurchaseProviderProps> = ({ children }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PageResponse<Purchase>['page'] | null>(null);

  const fetchPurchases = useCallback(async (filter?: PurchaseFilter) => {
    const isLoadMore = (filter?.page ?? 0) > 0;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const response = await purchaseService.getPurchases(filter);

      setPurchases((prev) => {
        if (!isLoadMore) {
          return response.data;
        }

        const merged = [...prev, ...response.data];
        return merged.filter((purchase, index, array) => array.findIndex((p) => p.id === purchase.id) === index);
      });

      setPage(response.page);
      setHasMore(!response.page.last);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar compras';
      setError(message);
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  const loadMorePurchases = useCallback(async (filter?: PurchaseFilter) => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    await fetchPurchases(filter);
  }, [fetchPurchases, hasMore, isLoadingMore]);

  const getPurchase = useCallback(async (id: number): Promise<Purchase> => {
    return purchaseService.getPurchaseById(id);
  }, []);

  const createPurchase = useCallback(async (data: NfceRequest): Promise<Purchase> => {
    const purchase = await purchaseService.createPurchaseFromQRCode(data);
    await fetchPurchases();
    return purchase;
  }, [fetchPurchases]);

  const updatePurchase = useCallback(async (
    id: number,
    data: Partial<{ date: string; totalPrice: number; supermarketId: number | null }>
  ): Promise<Purchase> => {
    const purchase = await purchaseService.updatePurchase(id, data);
    await fetchPurchases();
    return purchase;
  }, [fetchPurchases]);

  const deletePurchase = useCallback(async (id: number): Promise<void> => {
    await purchaseService.deletePurchase(id);
    await fetchPurchases();
  }, [fetchPurchases]);

  return (
    <PurchaseContext.Provider
      value={{
        purchases,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        page,
        fetchPurchases,
        loadMorePurchases,
        getPurchase,
        createPurchase,
        updatePurchase,
        deletePurchase,
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
