import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { purchaseService } from '../services';
import { Purchase, PurchaseFilter, PageResponse } from '../types';

interface PurchaseContextType {
  purchases: Purchase[];
  isLoading: boolean;
  error: string | null;
  page: PageResponse<Purchase>['page'] | null;
  fetchPurchases: (filter?: PurchaseFilter) => Promise<void>;
  getPurchase: (id: number) => Promise<Purchase>;
  createPurchase: (data: any) => Promise<Purchase>;
  updatePurchase: (id: number, data: any) => Promise<Purchase>;
  deletePurchase: (id: number) => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

interface PurchaseProviderProps {
  children: ReactNode;
}

export const PurchaseProvider: React.FC<PurchaseProviderProps> = ({ children }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PageResponse<Purchase>['page'] | null>(null);

  const fetchPurchases = useCallback(async (filter?: PurchaseFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const purchases = await purchaseService.getPurchases(filter);
      setPurchases(purchases);
      setPage(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar compras');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPurchase = useCallback(async (id: number): Promise<Purchase> => {
    return purchaseService.getPurchaseById(id);
  }, []);

  const createPurchase = useCallback(async (data: any): Promise<Purchase> => {
    const purchase = await purchaseService.createPurchaseFromQRCode(data);
    await fetchPurchases();
    return purchase;
  }, [fetchPurchases]);

  const updatePurchase = useCallback(async (id: number, data: any): Promise<Purchase> => {
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
        error,
        page,
        fetchPurchases,
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
