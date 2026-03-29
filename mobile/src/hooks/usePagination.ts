import { useState, useCallback } from 'react';

export interface PaginationState<T> {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  page: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
  } | null;
}

export interface PaginationActions<T> {
  fetchData: (fetcher: (page: number, size: number) => Promise<{ data: T[]; page: PaginationState<T>['page'] }>, page?: number) => Promise<void>;
  loadMore: (fetcher: (page: number, size: number) => Promise<{ data: T[]; page: PaginationState<T>['page'] }>) => Promise<void>;
  reset: () => void;
  updateItem: (id: number | string, updater: (item: T) => T) => void;
  removeItem: (id: number | string, getId: (item: T) => number | string) => void;
  addItem: (item: T) => void;
}

export function usePagination<T extends { id: number | string }>(pageSize: number = 20): [PaginationState<T>, PaginationActions<T>] {
  const [state, setState] = useState<PaginationState<T>>({
    data: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    error: null,
    page: null,
  });

  const fetchData = useCallback(async (
    fetcher: (page: number, size: number) => Promise<{ data: T[]; page: PaginationState<T>['page'] }>,
    page: number = 0
  ): Promise<void> => {
    const isLoadMore = page > 0;

    setState(prev => ({
      ...prev,
      isLoading: !isLoadMore,
      isLoadingMore: isLoadMore,
      error: null,
    }));

    try {
      const response = await fetcher(page, pageSize);

      setState(prev => {
        const newData = isLoadMore
          ? [...prev.data, ...response.data].filter((item, index, array) => {
              const id = (item as unknown as { id: number }).id;
              return array.findIndex((i) => (i as unknown as { id: number }).id === id) === index;
            })
          : response.data;

        return {
          ...prev,
          data: newData,
          page: response.page,
          hasMore: !response.page?.last,
          isLoading: false,
          isLoadingMore: false,
        };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setState(prev => ({
        ...prev,
        error: message,
        isLoading: false,
        isLoadingMore: false,
      }));
    }
  }, [pageSize]);

  const loadMore = useCallback(async (
    fetcher: (page: number, size: number) => Promise<{ data: T[]; page: PaginationState<T>['page'] }>
  ): Promise<void> => {
    if (state.isLoadingMore || !state.hasMore) {
      return;
    }

    const nextPage = (state.page?.pageNumber ?? 0) + 1;
    await fetchData(fetcher, nextPage);
  }, [fetchData, state.hasMore, state.isLoadingMore, state.page?.pageNumber]);

  const reset = useCallback((): void => {
    setState({
      data: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      error: null,
      page: null,
    });
  }, []);

  const updateItem = useCallback((id: number | string, updater: (item: T) => T): void => {
    setState(prev => ({
      ...prev,
      data: prev.data.map(item => {
        const itemId = (item as unknown as { id: number }).id;
        return itemId === id ? updater(item) : item;
      }),
    }));
  }, []);

  const removeItem = useCallback((id: number | string, getId: (item: T) => number | string): void => {
    setState(prev => ({
      ...prev,
      data: prev.data.filter(item => getId(item) !== id),
    }));
  }, []);

  const addItem = useCallback((item: T): void => {
    setState(prev => ({
      ...prev,
      data: [item, ...prev.data],
    }));
  }, []);

  return [state, { fetchData, loadMore, reset, updateItem, removeItem, addItem }];
}
