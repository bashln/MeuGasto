import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { draftService } from '../services';
import { Rascunho, RascunhoFilter, PageResponse, CreateRascunhoRequest, UpdateRascunhoRequest } from '../types';

interface DraftContextType {
  drafts: Rascunho[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  page: PageResponse<Rascunho>['page'] | null;
  fetchDrafts: (filter?: RascunhoFilter) => Promise<void>;
  loadMoreDrafts: (filter?: RascunhoFilter) => Promise<void>;
  getDraft: (id: number) => Promise<Rascunho>;
  createDraft: (data: CreateRascunhoRequest) => Promise<Rascunho>;
  updateDraft: (id: number, data: UpdateRascunhoRequest) => Promise<Rascunho>;
  deleteDraft: (id: number) => Promise<void>;
  convertToPurchase: (id: number) => Promise<void>;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

interface DraftProviderProps {
  children: ReactNode;
}

export const DraftProvider: React.FC<DraftProviderProps> = ({ children }) => {
  const [drafts, setDrafts] = useState<Rascunho[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PageResponse<Rascunho>['page'] | null>(null);

  const fetchDrafts = useCallback(async (filter?: RascunhoFilter) => {
    const isLoadMore = (filter?.page ?? 0) > 0;

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const response = await draftService.getDrafts(filter);

      setDrafts((prev) => {
        if (!isLoadMore) {
          return response.data;
        }

        const merged = [...prev, ...response.data];
        return merged.filter((draft, index, array) => array.findIndex((d) => d.id === draft.id) === index);
      });

      setPage(response.page);
      setHasMore(!response.page.last);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar rascunhos';
      setError(message);
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  const loadMoreDrafts = useCallback(async (filter?: RascunhoFilter) => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    await fetchDrafts(filter);
  }, [fetchDrafts, hasMore, isLoadingMore]);

  const getDraft = useCallback(async (id: number): Promise<Rascunho> => {
    return draftService.getDraftById(id);
  }, []);

  const createDraft = useCallback(async (data: CreateRascunhoRequest): Promise<Rascunho> => {
    const draft = await draftService.createDraft(data);
    await fetchDrafts();
    return draft;
  }, [fetchDrafts]);

  const updateDraft = useCallback(async (id: number, data: UpdateRascunhoRequest): Promise<Rascunho> => {
    const draft = await draftService.updateDraft(id, data);
    await fetchDrafts();
    return draft;
  }, [fetchDrafts]);

  const deleteDraft = useCallback(async (id: number): Promise<void> => {
    await draftService.deleteDraft(id);
    await fetchDrafts();
  }, [fetchDrafts]);

  const convertToPurchase = useCallback(async (id: number): Promise<void> => {
    await draftService.convertDraftToPurchase(id);
    await fetchDrafts();
  }, [fetchDrafts]);

  return (
    <DraftContext.Provider
      value={{
        drafts,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        page,
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
