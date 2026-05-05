import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';

interface UseReportsResult {
  isLoading: boolean;
  error: string | null;
  reportType: 'geral' | 'itens' | 'mercados' | 'categorias';
  selectedYear: number;
  selectedItem: string;
  monthlyData: Array<{ month: number; total: number }>;
  supermarketData: Array<{ supermarket: string; total: number }>;
  categoryData: Array<{ categoryId: number; category: string; total: number; percentage: number }>;
  topItems: Array<{ name: string; quantity: number; total: number }>;
  itemReport: {
    totalQuantity: number;
    totalSpent: number;
    averagePrice: number;
    purchaseCount: number;
    bySupermarket: Array<{
      supermarket: string;
      totalQuantity: number;
      totalSpent: number;
      averagePrice: number;
    }>;
  } | null;
  setReportType: (type: 'geral' | 'itens' | 'mercados' | 'categorias') => void;
  setSelectedYear: (year: number) => void;
  setSelectedItem: (item: string) => void;
  loadReport: () => Promise<void>;
  loadItemReport: (itemName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useReports = (): UseReportsResult => {
  const [reportType, setReportType] = useState<'geral' | 'itens' | 'mercados' | 'categorias'>('itens');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedItem, setSelectedItem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: number; total: number }>>([]);
  const [supermarketData, setSupermarketData] = useState<Array<{ supermarket: string; total: number }>>([]);
  const [categoryData, setCategoryData] = useState<Array<{ categoryId: number; category: string; total: number; percentage: number }>>([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number }>>([]);
  const [itemReport, setItemReport] = useState<UseReportsResult['itemReport']>(null);

  const resolveSelectedItem = useCallback(
    (items: Array<{ name: string }>, currentSelection: string) => {
      if (items.length === 0) return '';
      const hasCurrentSelection = items.some(item => item.name === currentSelection);
      if (hasCurrentSelection) return currentSelection;
      return items[0]?.name ?? '';
    },
    [],
  );

  const loadReportInternal = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    let nextTopItems: Array<{ name: string; quantity: number; total: number }> = [];

    try {
      if (reportType === 'geral') {
        const data = await reportService.getMonthlyExpenses(selectedYear);
        setMonthlyData(data);
        setTopItems([]);
        setCategoryData([]);
        setItemReport(null);
      } else if (reportType === 'itens') {
        const data = await reportService.getTopItems(10, startDate, endDate);
        nextTopItems = data;
        setTopItems(data);
      } else if (reportType === 'categorias') {
        const data = await reportService.getExpensesByCategory(startDate, endDate);
        setCategoryData(data);
        setTopItems([]);
        setItemReport(null);
      }

      const superData = await reportService.getExpensesBySupermarket(startDate, endDate);
      setSupermarketData(superData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar relatório';
      setError(message);
    } finally {
      setIsLoading(false);
    }

    return { topItems: nextTopItems };
  }, [reportType, selectedYear]);

  const loadReport = useCallback(async () => {
    await loadReportInternal();
  }, [loadReportInternal]);

  const loadItemReport = useCallback(async (itemName: string) => {
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    try {
      const data = await reportService.getItemReport(itemName, startDate, endDate);
      setItemReport(data);
    } catch {
      setItemReport(null);
    }
  }, [selectedYear]);

  const refresh = useCallback(async () => {
    const { topItems: refreshedTopItems } = await loadReportInternal();
    if (reportType !== 'itens') return;

    const nextSelectedItem = resolveSelectedItem(refreshedTopItems, selectedItem);
    setSelectedItem(nextSelectedItem);

    if (nextSelectedItem) {
      await loadItemReport(nextSelectedItem);
    }
  }, [loadItemReport, loadReportInternal, reportType, resolveSelectedItem, selectedItem]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (reportType !== 'itens') return;
    if (!selectedItem) {
      setItemReport(null);
      return;
    }
    loadItemReport(selectedItem);
  }, [reportType, selectedItem, loadItemReport]);

  useEffect(() => {
    if (reportType !== 'itens') return;
    setSelectedItem((prevSelectedItem) => {
      return resolveSelectedItem(topItems, prevSelectedItem);
    });
  }, [reportType, resolveSelectedItem, topItems]);

  return {
    isLoading,
    error,
    reportType,
    selectedYear,
    selectedItem,
    monthlyData,
    supermarketData,
    categoryData,
    topItems,
    itemReport,
    setReportType,
    setSelectedYear,
    setSelectedItem,
    loadReport,
    loadItemReport,
    refresh,
  };
};
