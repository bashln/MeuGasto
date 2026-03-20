import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';
import { getPeriodRange } from '../features/reports/utils/periodUtils';

type ReportType = 'geral' | 'itens' | 'mercados';
type PeriodOption = '3months' | '6months' | '12months' | 'year';

interface MarketDataPoint {
  supermarket: string;
  total: number;
  purchaseCount: number;
  averagePrice: number;
}

interface PriceHistoryPoint {
  month: number;
  year: number;
  averagePrice: number;
}

interface UseReportsResult {
  isLoading: boolean;
  error: string | null;
  reportType: ReportType;
  selectedYear: number;
  selectedPeriod: PeriodOption;
  selectedItem: string;
  monthlyData: Array<{ month: number; total: number }>;
  supermarketData: MarketDataPoint[];
  topItems: Array<{ name: string; quantity: number; total: number; percentage: number }>;
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
  itemPriceHistory: PriceHistoryPoint[];
  setReportType: (type: ReportType) => void;
  setSelectedYear: (year: number) => void;
  setSelectedPeriod: (period: PeriodOption) => void;
  setSelectedItem: (item: string) => void;
  loadReport: () => Promise<void>;
  loadItemReport: (itemName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const getPeriodReferenceDate = (selectedYear: number): Date => {
  const currentYear = new Date().getFullYear();
  if (selectedYear === currentYear) {
    return new Date();
  }

  return new Date(selectedYear, 11, 31);
};

export const useReports = (): UseReportsResult => {
  const [reportType, setReportType] = useState<ReportType>('itens');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('6months');
  const [selectedItem, setSelectedItem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: number; total: number }>>([]);
  const [supermarketData, setSupermarketData] = useState<MarketDataPoint[]>([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number; percentage: number }>>([]);
  const [itemPriceHistory, setItemPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [itemReport, setItemReport] = useState<UseReportsResult['itemReport']>(null);

  const loadItemReport = useCallback(
    async (itemName: string) => {
      if (!itemName) {
        setItemReport(null);
        setItemPriceHistory([]);
        return;
      }

      const periodRange = getPeriodRange(selectedPeriod, getPeriodReferenceDate(selectedYear));
      try {
        const [data, historyData] = await Promise.all([
          reportService.getItemReport(itemName, periodRange.startDate, periodRange.endDate),
          reportService.getItemPriceHistory(itemName, periodRange.startDate, periodRange.endDate),
        ]);

        setItemReport(data);
        setItemPriceHistory(historyData);
      } catch (error) {
        if (__DEV__) {
          console.error('Error loading item report:', error);
        }
        setItemReport(null);
        setItemPriceHistory([]);
      }
    },
    [selectedPeriod, selectedYear]
  );

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const periodRange = getPeriodRange(selectedPeriod, getPeriodReferenceDate(selectedYear));
    const startDate = periodRange.startDate;
    const endDate = periodRange.endDate;

    try {
      if (reportType === 'geral') {
        const monthly = await reportService.getMonthlyExpenses(startDate, endDate);
        setMonthlyData(monthly);

        const topItemsData = await reportService.getTopItems(10, startDate, endDate);
        const total = topItemsData.reduce((sum, item) => sum + item.total, 0);
        const topItemsWithPercentage = topItemsData.map((item) => ({
          ...item,
          percentage: total > 0 ? (item.total / total) * 100 : 0,
        }));

        setTopItems(topItemsWithPercentage);
        setItemReport(null);
        setItemPriceHistory([]);
        setSupermarketData([]);
      } else if (reportType === 'itens') {
        const topItemsData = await reportService.getTopItems(50, startDate, endDate);
        const total = topItemsData.reduce((sum, item) => sum + item.total, 0);
        const topItemsWithPercentage = topItemsData.map((item) => ({
          ...item,
          percentage: total > 0 ? (item.total / total) * 100 : 0,
        }));

        setTopItems(topItemsWithPercentage);
        setMonthlyData([]);
        setSupermarketData([]);
        // item report is loaded by the dedicated useEffect that watches selectedItem
      } else {
        const marketData = await reportService.getMarketRanking(startDate, endDate);

        setSupermarketData(marketData);
        setMonthlyData([]);
        setTopItems([]);
        setItemReport(null);
        setItemPriceHistory([]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar relatório';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [reportType, selectedYear, selectedPeriod]);

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
    if (reportType !== 'itens') {
      return;
    }

    if (!selectedItem) {
      setItemReport(null);
      setItemPriceHistory([]);
      return;
    }

    loadItemReport(selectedItem);
  }, [reportType, selectedItem, loadItemReport]);

  useEffect(() => {
    if (reportType !== 'itens') {
      return;
    }

    setSelectedItem((previousSelectedItem) => {
      if (topItems.length === 0) {
        return '';
      }

      const hasSelectedItem = topItems.some((item) => item.name === previousSelectedItem);
      if (hasSelectedItem) {
        return previousSelectedItem;
      }

      return topItems[0]?.name ?? '';
    });
  }, [reportType, topItems]);

  return {
    isLoading,
    error,
    reportType,
    selectedYear,
    selectedPeriod,
    selectedItem,
    monthlyData,
    supermarketData,
    topItems,
    itemReport,
    itemPriceHistory,
    setReportType,
    setSelectedYear,
    setSelectedPeriod,
    setSelectedItem,
    loadReport,
    loadItemReport,
    refresh,
  };
};
