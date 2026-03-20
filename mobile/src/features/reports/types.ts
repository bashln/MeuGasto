export type PeriodOption = '3months' | '6months' | '12months' | 'year';

export interface PeriodRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
  months: number;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
  icon?: string; // nome do ícone
}

export interface MetricCardData {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  trend?: {
    percentage: number;
    label: string; // ex: "+18% vs período anterior"
    isPositive: boolean;
  };
}

export interface PriceHistoryPoint {
  month: string; // nome abreviado do mês (Jan, Fev, etc.)
  averagePrice: number;
  trend: 'up' | 'stable' | 'down';
}

export interface MarketRankingItem {
  supermarket: string;
  averagePrice: number;
  totalSpent: number;
  purchaseCount: number;
  potentialSavings: number; // comparado ao mais barato
}

export interface TopItem {
  name: string;
  totalSpent: number;
  quantity: number;
  percentage: number;
}
