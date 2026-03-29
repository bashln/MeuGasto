import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services';
import { DashboardStats } from '../types';

interface UseDashboardResult {
  isLoading: boolean;
  isLoadingSavings: boolean;
  error: string | null;
  stats: DashboardStats | null;
  topItems: Array<{ name: string; quantity: number; total: number }>;
  supermarketData: Array<{ supermarket: string; total: number }>;
  monthlyTotals: Array<{ month: number; total: number }>;
  previousYearMonthlyTotals: Array<{ month: number; total: number }>;
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  loadDashboard: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useDashboard = (): UseDashboardResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSavings, setIsLoadingSavings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number }>>([]);
  const [supermarketData, setSupermarketData] = useState<Array<{ supermarket: string; total: number }>>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<Array<{ month: number; total: number }>>([]);
  const [previousYearMonthlyTotals, setPreviousYearMonthlyTotals] = useState<Array<{ month: number; total: number }>>([]);
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
    setIsLoadingSavings(false);
    setError(null);
    const { startDate, endDate } = getMonthRange(selectedMonth, selectedYear);
    
    try {
      // Fase 1: Carregar dados principais (prioridade alta)
      const [statsData, itemsData, marketsData, monthlyData, previousYearMonthlyData] = await Promise.all([
        reportService.getDashboardStats(selectedMonth, selectedYear),
        reportService.getTopItems(5, startDate, endDate),
        reportService.getExpensesBySupermarket(startDate, endDate),
        reportService.getMonthlyExpenses(selectedYear),
        selectedMonth === 1
          ? reportService.getMonthlyExpenses(selectedYear - 1)
          : Promise.resolve([] as Array<{ month: number; total: number }>),
      ]);
      
      // Mostrar dados principais imediatamente
      setStats(statsData);
      setTopItems(itemsData);
      setSupermarketData(marketsData);
      setMonthlyTotals(monthlyData);
      setPreviousYearMonthlyTotals(previousYearMonthlyData);
      setIsLoading(false);
      
      // Fase 2: Carregar economia em background (lazy load)
      setIsLoadingSavings(true);
      try {
        const savingsData = await reportService.getUserSavings(selectedMonth, selectedYear);
        setStats(currentStats => 
          currentStats ? { ...currentStats, savings: savingsData } : null
        );
      } catch (savingsError) {
        // Falha silenciosa - economia não é crítica
        if (__DEV__) {
          console.warn('[useDashboard] Failed to load savings:', savingsError);
        }
      } finally {
        setIsLoadingSavings(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dashboard';
      setError(message);
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
    isLoadingSavings,
    error,
    stats,
    topItems,
    supermarketData,
    monthlyTotals,
    previousYearMonthlyTotals,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    loadDashboard,
    refresh,
  };
};
