import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';
import { DashboardStats } from '../types';

interface UseDashboardResult {
  isLoading: boolean;
  error: string | null;
  stats: DashboardStats | null;
  topItems: Array<{ name: string; quantity: number; total: number }>;
  supermarketData: Array<{ supermarket: string; total: number }>;
  monthlyTotals: Array<{ month: number; total: number }>;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  loadDashboard: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useDashboard = (): UseDashboardResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number }>>([]);
  const [supermarketData, setSupermarketData] = useState<Array<{ supermarket: string; total: number }>>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<Array<{ month: number; total: number }>>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const getMonthRange = useCallback((month: number, year: number) => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear);
    
    try {
      const [statsData, itemsData, marketsData, monthlyData] = await Promise.all([
        reportService.getDashboardStats(selectedMonth, selectedYear),
        reportService.getTopItems(5, startDate, endDate),
        reportService.getExpensesBySupermarket(startDate, endDate),
        reportService.getMonthlyExpenses(selectedYear),
      ]);
      setStats(statsData);
      setTopItems(itemsData);
      setSupermarketData(marketsData);
      setMonthlyTotals(monthlyData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, getMonthRange]);

  const refresh = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    isLoading,
    error,
    stats,
    topItems,
    supermarketData,
    monthlyTotals,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    loadDashboard,
    refresh,
  };
};
