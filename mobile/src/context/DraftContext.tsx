import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { draftService } from '../services';
import { Draft, DraftFilter, PageResponse, CreateDraftRequest, UpdateDraftRequest } from '../types';

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
  children: ReactNode;
}

export const DraftProvider: React.FC<DraftProviderProps> = ({ children }) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PageResponse<Draft>['page'] | null>(null);

  const fetchDrafts = useCallback(async (filter?: DraftFilter) => {
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

  const loadMoreDrafts = useCallback(async (filter?: DraftFilter) => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    await fetchDrafts(filter);
  }, [fetchDrafts, hasMore, isLoadingMore]);

  const getDraft = useCallback(async (id: number): Promise<Draft> => {
    return draftService.getDraftById(id);
  }, []);

  const createDraft = useCallback(async (data: CreateDraftRequest): Promise<Draft> => {
    const draft = await draftService.createDraft(data);
    await fetchDrafts();
    return draft;
  }, [fetchDrafts]);

  const updateDraft = useCallback(async (id: number, data: UpdateDraftRequest): Promise<Draft> => {
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
