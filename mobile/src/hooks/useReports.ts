import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';

interface UseReportsResult {
  isLoading: boolean;
  error: string | null;
  reportType: 'geral' | 'itens' | 'mercados';
  selectedYear: number;
  selectedItem: string;
  monthlyData: Array<{ month: number; total: number }>;
  supermarketData: Array<{ supermarket: string; total: number }>;
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
  setReportType: (type: 'geral' | 'itens' | 'mercados') => void;
  setSelectedYear: (year: number) => void;
  setSelectedItem: (item: string) => void;
  loadReport: () => Promise<void>;
  loadItemReport: (itemName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useReports = (): UseReportsResult => {
  const [reportType, setReportType] = useState<'geral' | 'itens' | 'mercados'>('itens');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedItem, setSelectedItem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: number; total: number }>>([]);
  const [supermarketData, setSupermarketData] = useState<Array<{ supermarket: string; total: number }>>([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number }>>([]);
  const [itemReport, setItemReport] = useState<UseReportsResult['itemReport']>(null);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    try {
      if (reportType === 'geral') {
        const data = await reportService.getMonthlyExpenses(selectedYear);
        setMonthlyData(data);
        setTopItems([]);
        setItemReport(null);
      } else if (reportType === 'itens') {
        const data = await reportService.getTopItems(10, startDate, endDate);
        setTopItems(data);
      }

      const superData = await reportService.getExpensesBySupermarket(startDate, endDate);
      setSupermarketData(superData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar relatório';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [reportType, selectedYear]);

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
    await loadReport();
    if (selectedItem && reportType === 'itens') {
      await loadItemReport(selectedItem);
    }
  }, [loadReport, loadItemReport, selectedItem, reportType]);

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
      if (topItems.length === 0) {
        return prevSelectedItem ? '' : prevSelectedItem;
      }

      const hasSelectedItem = topItems.some(item => item.name === prevSelectedItem);
      if (hasSelectedItem) {
        return prevSelectedItem;
      }

      return topItems[0]?.name ?? '';
    });
  }, [reportType, topItems]);

  return {
    isLoading,
    error,
    reportType,
    selectedYear,
    selectedItem,
    monthlyData,
    supermarketData,
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
