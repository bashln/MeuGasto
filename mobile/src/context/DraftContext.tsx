import React, { createContext, useContext, useCallback } from 'react';
import { draftService } from '../services';
import { Draft, DraftFilter, PageResponse, CreateDraftRequest, UpdateDraftRequest } from '../types';
import { usePagination } from '../hooks/usePagination';

interface DraftContextType {
  drafts: Draft[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  page: PageResponse<Draft>['page'] | null;
  fetchDrafts: (filter?: DraftFilter) => Promise<void>;
  loadMoreDrafts: (filter?: DraftFilter) => Promise<void>;
  getDraft: (id: number) => Promise<Draft>;
  createDraft: (data: CreateDraftRequest) => Promise<Draft>;
  updateDraft: (id: number, data: UpdateDraftRequest) => Promise<Draft>;
  deleteDraft: (id: number) => Promise<void>;
  convertToPurchase: (id: number) => Promise<void>;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

interface DraftProviderProps {
  children: React.ReactNode;
}

const PAGE_SIZE = 20;

export const DraftProvider: React.FC<DraftProviderProps> = ({ children }) => {
  const [paginationState, paginationActions] = usePagination<Draft>(PAGE_SIZE);

  const fetchDrafts = useCallback(async (filter?: DraftFilter) => {
    const page = filter?.page ?? 0;
    
    await paginationActions.fetchData(
      async (p, size) => {
        const response = await draftService.getDrafts({
          ...filter,
          page: p,
          size,
        });
        return response;
      },
      page
    );
  }, [paginationActions]);

  const loadMoreDrafts = useCallback(async (filter?: DraftFilter) => {
    if (paginationState.isLoadingMore || !paginationState.hasMore) {
      return;
    }

    const nextPage = (paginationState.page?.pageNumber ?? 0) + 1;
    await fetchDrafts({ ...filter, page: nextPage });
  }, [fetchDrafts, paginationState.hasMore, paginationState.isLoadingMore, paginationState.page?.pageNumber]);

  const getDraft = useCallback(async (id: number): Promise<Draft> => {
    return draftService.getDraftById(id);
  }, []);

  const createDraft = useCallback(async (data: CreateDraftRequest): Promise<Draft> => {
    const draft = await draftService.createDraft(data);
    // Update otimista: adiciona ao início da lista
    paginationActions.addItem(draft);
    return draft;
  }, [paginationActions]);

  const updateDraft = useCallback(async (id: number, data: UpdateDraftRequest): Promise<Draft> => {
    // Update otimista: atualiza localmente primeiro
    const previousDraft = paginationState.data.find(d => d.id === id);
    
    if (previousDraft) {
      paginationActions.updateItem(id, (draft) => ({
        ...draft,
        ...data,
        content: data.content ?? draft.content,
        items: data.items ?? draft.items,
        supermarket: data.supermarketId !== undefined && draft.supermarket
          ? { ...draft.supermarket, id: data.supermarketId }
          : draft.supermarket,
      }));
    }

    try {
      const draft = await draftService.updateDraft(id, data);
      // Confirma o update com dados do servidor
      paginationActions.updateItem(id, () => draft);
      return draft;
    } catch (error) {
      // Rollback em caso de erro
      if (previousDraft) {
        paginationActions.updateItem(id, () => previousDraft);
      }
      throw error;
    }
  }, [paginationActions, paginationState.data]);

  const deleteDraft = useCallback(async (id: number): Promise<void> => {
    // Update otimista: remove localmente primeiro
    paginationActions.removeItem(id, (draft) => draft.id);

    try {
      await draftService.deleteDraft(id);
    } catch (error) {
      if (__DEV__) {
        console.warn('[DraftContext] Erro ao deletar, item removido localmente:', error);
      }
      throw error;
    }
  }, [paginationActions]);

  const convertToPurchase = useCallback(async (id: number): Promise<void> => {
    // Update otimista: remove rascunho (vai virar compra)
    paginationActions.removeItem(id, (draft) => draft.id);

    try {
      await draftService.convertDraftToPurchase(id);
    } catch (error) {
      // Recarrega em caso de erro para restaurar estado
      if (__DEV__) {
        console.warn('[DraftContext] Erro ao converter, recarregando lista:', error);
      }
      await fetchDrafts();
      throw error;
    }
  }, [fetchDrafts, paginationActions]);

  return (
    <DraftContext.Provider
      value={{
        drafts: paginationState.data,
        isLoading: paginationState.isLoading,
        isLoadingMore: paginationState.isLoadingMore,
        hasMore: paginationState.hasMore,
        error: paginationState.error,
        page: paginationState.page,
        fetchDrafts,
        loadMoreDrafts,
        getDraft,
        createDraft,
        updateDraft,
        deleteDraft,
        convertToPurchase,
      }}
    >
      {children}
    </DraftContext.Provider>
  );
};

export const useDrafts = (): DraftContextType => {
  const context = useContext(DraftContext);
  if (context === undefined) {
    throw new Error('useDrafts must be used within a DraftProvider');
  }
  return context;
};
