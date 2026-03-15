import { useEffect, useState } from 'react';
import { reportService } from '../../../services';
import { getPreviousPeriodRange } from '../utils/periodUtils';

type PeriodOption = '3months' | '6months' | '12months' | 'year';
type ReportType = 'geral' | 'itens' | 'mercados';

interface MonthlyDataPoint {
  month: number;
  total: number;
}

interface SupermarketDataPoint {
  supermarket: string;
  total: number;
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

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral';
}

interface UseReportInsightsProps {
  currentData: MonthlyDataPoint[] | SupermarketDataPoint[] | ItemReportData | null;
  period: PeriodOption;
  reportType: ReportType;
  selectedItem?: string;
  selectedYear?: number;
}

const isMonthlyData = (data: MonthlyDataPoint[] | SupermarketDataPoint[] | ItemReportData): data is MonthlyDataPoint[] => {
  if (!Array.isArray(data)) {
    return false;
  }

  if (data.length === 0) {
    return true;
  }

  return 'month' in data[0] && 'total' in data[0] && !('supermarket' in data[0]);
};

const isSupermarketData = (data: MonthlyDataPoint[] | SupermarketDataPoint[] | ItemReportData): data is SupermarketDataPoint[] => {
  if (!Array.isArray(data)) {
    return false;
  }

  if (data.length === 0) {
    return true;
  }

  return 'supermarket' in data[0] && 'total' in data[0];
};

const isItemReportData = (data: MonthlyDataPoint[] | SupermarketDataPoint[] | ItemReportData): data is ItemReportData => {
  return !Array.isArray(data) && data !== null && 'totalQuantity' in data;
};

const toTotal = (items: Array<{ total: number }>): number => items.reduce((sum, item) => sum + item.total, 0);

const getReferenceDate = (selectedYear?: number): Date => {
  if (!selectedYear) {
    return new Date();
  }

  const currentYear = new Date().getFullYear();
  if (selectedYear === currentYear) {
    return new Date();
  }

  return new Date(selectedYear, 11, 31);
};

const getVariation = (currentValue: number, previousValue: number): number => {
  if (previousValue <= 0) {
    return 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

export const useReportInsights = ({
  currentData,
  period,
  reportType,
  selectedItem,
  selectedYear,
}: UseReportInsightsProps) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const generateInsights = async () => {
      if (!currentData) {
        setInsights([]);
        return;
      }

      setLoading(true);
      try {
        const referenceDate = getReferenceDate(selectedYear);
        const previousRange = getPreviousPeriodRange(period, referenceDate);
        const generatedInsights: Insight[] = [];

        if (reportType === 'geral') {
          if (!isMonthlyData(currentData)) {
            setInsights([]);
            return;
          }
          const currentTotal = toTotal(currentData);
          const previousMarketData = await reportService.getExpensesBySupermarket(
            previousRange.startDate,
            previousRange.endDate
          );
          const previousTotal = toTotal(previousMarketData);

          if (currentTotal === 0) {
            generatedInsights.push({
              id: 'geral-no-data',
              title: 'Sem gastos no periodo',
              description: 'Nao ha despesas registradas para gerar comparacoes neste periodo.',
              type: 'neutral',
            });
          } else if (previousTotal === 0) {
            generatedInsights.push({
              id: 'geral-first-period',
              title: 'Primeiro periodo com dados',
              description: 'Nao ha registros no periodo anterior equivalente para comparacao.',
              type: 'neutral',
            });
          } else {
            const variation = getVariation(currentTotal, previousTotal);
            generatedInsights.push({
              id: 'geral-total-spent',
              title: variation > 0 ? 'Gasto em alta' : 'Gasto em queda',
              description: `${Math.abs(variation).toFixed(1)}% ${variation > 0 ? 'acima' : 'abaixo'} do periodo anterior equivalente.`,
              type: variation > 0 ? 'negative' : 'positive',
            });
          }
        }

        if (reportType === 'itens') {
          if (!isItemReportData(currentData)) {
            setInsights([]);
            return;
          }
          const itemData = currentData;
          if (!selectedItem || itemData.purchaseCount === 0) {
            generatedInsights.push({
              id: 'item-no-data',
              title: 'Sem dados do item',
              description: 'Selecione um item com compras no periodo para comparacao.',
              type: 'neutral',
            });
          } else {
            const previousItemData = await reportService.getItemReport(
              selectedItem,
              previousRange.startDate,
              previousRange.endDate
            );

            if (previousItemData.purchaseCount === 0) {
              generatedInsights.push({
                id: 'item-no-previous-data',
                title: 'Sem historico anterior',
                description: `Nao ha compras anteriores de ${selectedItem} para comparacao equivalente.`,
                type: 'neutral',
              });
            } else {
              const priceVariation = getVariation(itemData.averagePrice, previousItemData.averagePrice);
              generatedInsights.push({
                id: 'item-price-variation',
                title: priceVariation > 0 ? 'Preco medio subiu' : 'Preco medio caiu',
                description: `${selectedItem}: ${Math.abs(priceVariation).toFixed(1)}% ${priceVariation > 0 ? 'acima' : 'abaixo'} do periodo anterior.`,
                type: priceVariation > 0 ? 'negative' : 'positive',
              });
            }
          }
        }

        if (reportType === 'mercados') {
          if (!isSupermarketData(currentData)) {
            setInsights([]);
            return;
          }
          const currentMarketData = currentData;
          const previousMarketData = await reportService.getExpensesBySupermarket(
            previousRange.startDate,
            previousRange.endDate
          );

          const currentTotal = toTotal(currentMarketData);
          const previousTotal = toTotal(previousMarketData);

          if (currentMarketData.length === 0) {
            generatedInsights.push({
              id: 'markets-no-data',
              title: 'Sem dados de mercados',
              description: 'Nao ha compras registradas por mercado no periodo selecionado.',
              type: 'neutral',
            });
          } else if (previousTotal > 0) {
            const variation = getVariation(currentTotal, previousTotal);
            generatedInsights.push({
              id: 'markets-total-variation',
              title: variation > 0 ? 'Gasto por mercado em alta' : 'Gasto por mercado em queda',
              description: `${Math.abs(variation).toFixed(1)}% ${variation > 0 ? 'acima' : 'abaixo'} do periodo anterior equivalente.`,
              type: variation > 0 ? 'negative' : 'positive',
            });
          }

          const currentTop = [...currentMarketData].sort((left, right) => right.total - left.total)[0];
          if (currentTop) {
            generatedInsights.push({
              id: 'markets-top-market',
              title: 'Mercado com maior participacao',
              description: `${currentTop.supermarket} concentrou ${((currentTop.total / Math.max(currentTotal, 1)) * 100).toFixed(1)}% do gasto no periodo.`,
              type: 'neutral',
            });
          }
        }

        if (active) {
          setInsights(generatedInsights);
        }
      } catch (error) {
        if (active) {
          console.error('Erro ao gerar insights:', error);
          setInsights([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    generateInsights();

    return () => {
      active = false;
    };
  }, [currentData, period, reportType, selectedItem, selectedYear]);

  return { insights, loading };
};
