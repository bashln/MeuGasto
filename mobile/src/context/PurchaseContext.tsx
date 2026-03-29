import React, { createContext, useContext, useCallback } from 'react';
import { purchaseService } from '../services';
import { Purchase, PurchaseFilter, PageResponse } from '../types';
import { usePagination } from '../hooks/usePagination';

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
}

const PurchaseContext = createContext<PurchaseContextType | undefined>(undefined);

interface PurchaseProviderProps {
  children: React.ReactNode;
}

const PAGE_SIZE = 20;

export const PurchaseProvider: React.FC<PurchaseProviderProps> = ({ children }) => {
  const [paginationState, paginationActions] = usePagination<Purchase>(PAGE_SIZE);

  const fetchPurchases = useCallback(async (filter?: PurchaseFilter) => {
    const page = filter?.page ?? 0;
    
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
  }, [paginationActions]);

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
    // Update otimista: atualiza localmente primeiro
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
      // Confirma o update com dados do servidor
      paginationActions.updateItem(id, () => purchase);
      return purchase;
    } catch (error) {
      // Rollback: restaura estado anterior em caso de erro
      if (previousPurchase) {
        paginationActions.updateItem(id, () => previousPurchase);
      }
      throw error;
    }
  }, [paginationActions, paginationState.data]);

  const deletePurchase = useCallback(async (id: number): Promise<void> => {
    // Update otimista: remove localmente primeiro
    paginationActions.removeItem(id, (purchase) => purchase.id);

    try {
      await purchaseService.deletePurchase(id);
    } catch (error) {
      // Rollback seria complexo (precisaria recarregar), então só logamos
      if (__DEV__) {
        console.warn('[PurchaseContext] Erro ao deletar, item removido localmente:', error);
      }
      throw error;
    }
  }, [paginationActions]);

  const updatePurchaseItems = useCallback(async (
    id: number,
    items: Array<{ id?: number; name: string; quantity: number; unit: string; price: number }>
  ): Promise<Purchase> => {
    // Calcula novo total para update otimista
    const newTotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    // Update otimista: atualiza items e total localmente
    paginationActions.updateItem(id, (purchase) => ({
      ...purchase,
      products: items.map((item, index) => ({
        id: item.id || -(index + 1), // IDs temporários negativos para novos items
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
      // Confirma o update com dados do servidor
      paginationActions.updateItem(id, () => purchase);
      return purchase;
    } catch (error) {
      // Em caso de erro, recarrega a compra para restaurar estado
      if (__DEV__) {
        console.warn('[PurchaseContext] Erro ao atualizar items, recarregando compra:', error);
      }
      try {
        const refreshedPurchase = await purchaseService.getPurchaseById(id);
        paginationActions.updateItem(id, () => refreshedPurchase);
      } catch (refreshError) {
        // Se não conseguir recarregar, mantém o estado anterior
        if (__DEV__) {
          console.error('[PurchaseContext] Falha ao recarregar compra:', refreshError);
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
