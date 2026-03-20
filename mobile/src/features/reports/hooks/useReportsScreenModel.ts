import { useCallback } from 'react';
import { Alert, Share } from 'react-native';
import { toCsvRow } from '../../../lib/csvSecurity';
import { getMonthName } from '../../../utils';
import { useReportInsights } from './useReportInsights';
import { useReports } from './useReports';

const EMPTY_ITEM_REPORT = {
  totalQuantity: 0,
  totalSpent: 0,
  averagePrice: 0,
  purchaseCount: 0,
  bySupermarket: [] as Array<{
    supermarket: string;
    totalQuantity: number;
    totalSpent: number;
    averagePrice: number;
  }>,
};

export const useReportsScreenModel = () => {
  const reports = useReports();
  const itemReportData = reports.itemReport ?? EMPTY_ITEM_REPORT;

  const { insights, loading: insightsLoading } = useReportInsights({
    currentData:
      reports.reportType === 'geral'
        ? reports.monthlyData
        : reports.reportType === 'itens'
          ? itemReportData
          : reports.supermarketData,
    period: reports.selectedPeriod,
    reportType: reports.reportType,
    selectedItem: reports.selectedItem,
    selectedYear: reports.selectedYear,
  });

  const handleExportCSV = useCallback(async () => {
    let csvString = '';

    if (reports.reportType === 'geral') {
      csvString = [
        toCsvRow(['Mes', 'Total']),
        ...reports.monthlyData.map((month) => toCsvRow([getMonthName(month.month), month.total.toFixed(2)])),
      ].join('\n');
    } else if (reports.reportType === 'itens') {
      csvString = [
        toCsvRow(['Supermercado', 'Preco Medio', 'Qtd Total', 'Total Gasto']),
        ...itemReportData.bySupermarket.map((row) =>
          toCsvRow([
            row.supermarket,
            row.averagePrice.toFixed(2),
            row.totalQuantity,
            row.totalSpent.toFixed(2),
          ])
        ),
      ].join('\n');
    } else {
      const positiveAverages = reports.supermarketData
        .map((market) => market.averagePrice)
        .filter((averagePrice) => averagePrice > 0);
      const cheapestAverage = positiveAverages.length > 0 ? Math.min(...positiveAverages) : 0;
      const marketRankingData = reports.supermarketData.map((market) => ({
        supermarket: market.supermarket,
        averagePrice: market.averagePrice,
        totalSpent: market.total,
        purchaseCount: market.purchaseCount,
        potentialSavings: Math.max(market.averagePrice - cheapestAverage, 0) * market.purchaseCount,
      }));

      csvString = [
        toCsvRow(['Supermercado', 'Ticket Medio', 'Total', 'Compras', 'Economia Potencial']),
        ...marketRankingData.map((market) =>
          toCsvRow([
            market.supermarket,
            market.averagePrice.toFixed(2),
            market.totalSpent.toFixed(2),
            market.purchaseCount,
            market.potentialSavings.toFixed(2),
          ])
        ),
      ].join('\n');
    }

    try {
      await Share.share({ message: csvString, title: 'relatorio.csv' });
    } catch (error) {
      if (__DEV__) {
        console.error('Error exporting CSV:', error);
      }
      Alert.alert('Erro', 'Não foi possível exportar o relatório.');
    }
  }, [itemReportData.bySupermarket, reports.monthlyData, reports.reportType, reports.supermarketData]);

  return {
    ...reports,
    itemReportData,
    insights,
    insightsLoading,
    handleExportCSV,
  };
};
