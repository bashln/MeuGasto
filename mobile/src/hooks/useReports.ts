import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';

export type PeriodMode = 'month' | 'year';

export interface CategoryWithDelta {
  categoryId: number;
  category: string;
  total: number;
  percentage: number;
  prevTotal: number;
  delta: number | null;
}

interface ItemReportData {
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
}

export interface UseReportsResult {
  isLoading: boolean;
  error: string | null;
  periodMode: PeriodMode;
  selectedMonth: number;
  selectedYear: number;
  heroValue: number;
  prevHeroValue: number;
  sparklineData: Array<{ month: number; total: number }>;
  categoryData: CategoryWithDelta[];
  supermarketData: Array<{ supermarket: string; total: number }>;
  topItems: Array<{ name: string; quantity: number; total: number }>;
  itemReport: ItemReportData | null;
  selectedItem: string;
  setPeriodMode: (mode: PeriodMode) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setSelectedItem: (item: string) => void;
  loadItemReport: (itemName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const getMonthRange = (month: number, year: number) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

const getPrevMonth = (month: number, year: number): { month: number; year: number } => {
  if (month === 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
};

const mergeCategoriesWithDelta = (
  current: Array<{ categoryId: number; category: string; total: number; percentage: number }>,
  prev: Array<{ categoryId: number; category: string; total: number; percentage: number }>
): CategoryWithDelta[] => {
  const prevMap = new Map(prev.map(c => [c.categoryId, c.total]));
  return current.map(cat => {
    const prevTotal = prevMap.get(cat.categoryId) ?? 0;
    const delta = prevTotal > 0
      ? ((cat.total - prevTotal) / prevTotal) * 100
      : null;
    return { ...cat, prevTotal, delta };
  });
};

export const useReports = (): UseReportsResult => {
  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroValue, setHeroValue] = useState(0);
  const [prevHeroValue, setPrevHeroValue] = useState(0);
  const [sparklineData, setSparklineData] = useState<Array<{ month: number; total: number }>>([]);
  const [categoryData, setCategoryData] = useState<CategoryWithDelta[]>([]);
  const [supermarketData, setSupermarketData] = useState<Array<{ supermarket: string; total: number }>>([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number }>>([]);
  const [itemReport, setItemReport] = useState<ItemReportData | null>(null);
  const [selectedItem, setSelectedItem] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (periodMode === 'month') {
        const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear);
        const { month: prevMonth, year: prevYear } = getPrevMonth(selectedMonth, selectedYear);
        const { startDate: prevStart, endDate: prevEnd } = getMonthRange(prevMonth, prevYear);

        const [stats, prevStats, markets, items, sparkline] = await Promise.all([
          reportService.getDashboardStats(selectedMonth, selectedYear),
          reportService.getDashboardStats(prevMonth, prevYear),
          reportService.getExpensesBySupermarket(startDate, endDate),
          reportService.getTopItems(10, startDate, endDate),
          reportService.getMonthlyExpenses(selectedYear),
        ]);

        const [cats, prevCats] = await Promise.all([
          reportService.getExpensesByCategory(startDate, endDate).catch(() => []),
          reportService.getExpensesByCategory(prevStart, prevEnd).catch(() => []),
        ]);

        setHeroValue(stats.totalSpent);
        setPrevHeroValue(prevStats.totalSpent);
        setSparklineData(sparkline);
        setCategoryData(mergeCategoriesWithDelta(cats, prevCats));
        setSupermarketData(markets);
        setTopItems(items);
      } else {
        const yearStart = `${selectedYear}-01-01`;
        const yearEnd = `${selectedYear}-12-31`;
        const prevYearStart = `${selectedYear - 1}-01-01`;
        const prevYearEnd = `${selectedYear - 1}-12-31`;

        const [sparkline, prevSparkline, markets, items] = await Promise.all([
          reportService.getMonthlyExpenses(selectedYear),
          reportService.getMonthlyExpenses(selectedYear - 1),
          reportService.getExpensesBySupermarket(yearStart, yearEnd),
          reportService.getTopItems(10, yearStart, yearEnd),
        ]);

        const [cats, prevCats] = await Promise.all([
          reportService.getExpensesByCategory(yearStart, yearEnd).catch(() => []),
          reportService.getExpensesByCategory(prevYearStart, prevYearEnd).catch(() => []),
        ]);

        const heroVal = sparkline.reduce((s, m) => s + m.total, 0);
        const prevHeroVal = prevSparkline.reduce((s, m) => s + m.total, 0);

        setHeroValue(heroVal);
        setPrevHeroValue(prevHeroVal);
        setSparklineData(sparkline);
        setCategoryData(mergeCategoriesWithDelta(cats, prevCats));
        setSupermarketData(markets);
        setTopItems(items);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar relatório';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [periodMode, selectedMonth, selectedYear]);

  const loadItemReport = useCallback(async (itemName: string) => {
    try {
      const { startDate, endDate } = periodMode === 'month'
        ? getMonthRange(selectedMonth, selectedYear)
        : { startDate: `${selectedYear}-01-01`, endDate: `${selectedYear}-12-31` };

      const data = await reportService.getItemReport(itemName, startDate, endDate);
      setItemReport(data);
    } catch {
      setItemReport(null);
    }
  }, [periodMode, selectedMonth, selectedYear]);

  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    isLoading,
    error,
    periodMode,
    selectedMonth,
    selectedYear,
    heroValue,
    prevHeroValue,
    sparklineData,
    categoryData,
    supermarketData,
    topItems,
    itemReport,
    selectedItem,
    setPeriodMode,
    setSelectedMonth,
    setSelectedYear,
    setSelectedItem,
    loadItemReport,
    refresh,
  };
};
