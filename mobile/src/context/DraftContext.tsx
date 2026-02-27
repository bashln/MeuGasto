import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { draftService } from '../services';
import { Rascunho, RascunhoFilter, PageResponse, CreateRascunhoRequest, UpdateRascunhoRequest } from '../types';

interface DraftContextType {
  drafts: Rascunho[];
  isLoading: boolean;
  error: string | null;
  page: PageResponse<Rascunho>['page'] | null;
  fetchDrafts: (filter?: RascunhoFilter) => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PageResponse<Rascunho>['page'] | null>(null);

  const fetchDrafts = useCallback(async (filter?: RascunhoFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await draftService.getDrafts(filter);
      setDrafts(response.data);
      setPage(response.page);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar rascunhos');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        error,
        page,
        fetchDrafts,
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
