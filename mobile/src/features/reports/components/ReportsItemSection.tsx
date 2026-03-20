import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InsightsBlock } from './InsightsBlock';
import { PriceHistoryChart } from './PriceHistoryChart';
import { calculatePriceStats, formatPriceStats } from '../utils/priceUtils';
import { colors } from '../../../theme/colors';
import { formatMoney, getMonthName } from '../../../utils';

interface ReportsItemSectionProps {
  selectedItem: string;
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
  };
  itemPriceHistory: Array<{ month: number; year: number; averagePrice: number }>;
  insights: Array<{ id: string; title: string; description: string; type: 'positive' | 'negative' | 'neutral' }>;
  insightsLoading: boolean;
  onOpenItemPicker: () => void;
}

export const ReportsItemSection: React.FC<ReportsItemSectionProps> = ({
  selectedItem,
  itemReport,
  itemPriceHistory,
  insights,
  insightsLoading,
  onOpenItemPicker,
}) => {
  const hasItemData = itemReport.totalQuantity > 0;
  const priceStats = useMemo(() => calculatePriceStats(itemReport), [itemReport]);
  const formattedPriceStats = useMemo(() => formatPriceStats(priceStats), [priceStats]);
  const comparisonPrices = itemReport.bySupermarket
    .map((row) => row.averagePrice)
    .filter((price) => price > 0);
  const minPrice = comparisonPrices.length > 0 ? Math.min(...comparisonPrices) : 0;
  const maxPrice = comparisonPrices.length > 0 ? Math.max(...comparisonPrices) : 0;
  const priceHistoryData = itemPriceHistory.map((historyPoint) => ({
    month: getMonthName(historyPoint.month).substring(0, 3),
    averagePrice: historyPoint.averagePrice,
  }));

  return (
    <>
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Item especifico</RNText>
          <TouchableOpacity style={styles.filterSelect} onPress={onOpenItemPicker}>
            <RNText style={styles.filterSelectText}>{selectedItem || 'Nenhum item encontrado'}</RNText>
            <MaterialCommunityIcons name="chevron-down" size={14} color={colors.mutedText} />
          </TouchableOpacity>
        </View>
      </View>

      <InsightsBlock insights={insights} loading={insightsLoading} />

      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Preco medio/un</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? formatMoney(itemReport.averagePrice) : 'Sem dados no periodo'}
          </RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Total gasto</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? formatMoney(itemReport.totalSpent) : 'Sem dados no periodo'}
          </RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Notas</RNText>
          <RNText style={styles.metricValue}>{hasItemData ? `${itemReport.purchaseCount}x` : 'Sem dados'}</RNText>
        </View>
      </View>

      <View style={styles.priceRangeCard}>
        <View style={styles.priceRangeRow}>
          <RNText style={styles.priceRangeLabel}>Menor preco</RNText>
          <View style={styles.priceRangeValue}>
            <RNText style={styles.priceRangePrice}>
              {hasItemData ? formattedPriceStats.minPrice : 'Sem dados'}
            </RNText>
            {hasItemData && formattedPriceStats.minPriceSupermarket ? (
              <RNText style={styles.priceRangeSupermarket}>em {formattedPriceStats.minPriceSupermarket}</RNText>
            ) : null}
          </View>
        </View>
        <View style={styles.priceRangeRow}>
          <RNText style={styles.priceRangeLabel}>Maior preco</RNText>
          <View style={styles.priceRangeValue}>
            <RNText style={styles.priceRangePrice}>
              {hasItemData ? formattedPriceStats.maxPrice : 'Sem dados'}
            </RNText>
            {hasItemData && formattedPriceStats.maxPriceSupermarket ? (
              <RNText style={styles.priceRangeSupermarket}>em {formattedPriceStats.maxPriceSupermarket}</RNText>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.chartCard}>
        <RNText style={styles.chartTitle}>Historico de preco</RNText>
        <PriceHistoryChart data={priceHistoryData} />
      </View>

      <View style={styles.itemAnalyzedCard}>
        <RNText style={styles.itemAnalyzedTitle}>{selectedItem || 'Item selecionado'}</RNText>
        <RNText style={styles.itemAnalyzedDesc}>
          {hasItemData
            ? `Compras: ${itemReport.purchaseCount} • Quantidade: ${itemReport.totalQuantity} • Preco medio: ${formatMoney(itemReport.averagePrice)}`
            : 'Dados insuficientes para este item. Tente selecionar outro item ou ampliar o periodo.'}
        </RNText>
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <RNText style={styles.tableHeaderText}>Mercado</RNText>
          <RNText style={styles.tableHeaderText}>Preco</RNText>
          <RNText style={styles.tableHeaderText}>Status</RNText>
        </View>

        {itemReport.bySupermarket.length === 0 ? (
          <View style={styles.emptyComparisonRow}>
            <RNText style={styles.emptyComparisonText}>Nao ha dados suficientes para comparacao neste periodo.</RNText>
          </View>
        ) : (
          itemReport.bySupermarket.map((row, index) => {
            const isLast = index === itemReport.bySupermarket.length - 1;
            const hasMultiple = comparisonPrices.length > 1;
            let statusLabel = '-';

            if (hasMultiple) {
              if (row.averagePrice === minPrice) {
                statusLabel = 'Melhor preco';
              } else if (row.averagePrice === maxPrice) {
                statusLabel = 'Mais caro';
              }
            } else {
              statusLabel = 'Unico';
            }

            return (
              <View key={`${row.supermarket}-${index}`} style={[styles.tableRow, isLast && styles.tableRowLast]}>
                <RNText style={styles.tableCell}>{row.supermarket}</RNText>
                <RNText style={styles.tableCellPrice}>{formatMoney(row.averagePrice)}</RNText>
                <View style={styles.statusContainer}>
                  <RNText
                    style={
                      statusLabel === 'Melhor preco'
                        ? styles.statusBest
                        : statusLabel === 'Mais caro'
                          ? styles.statusWorst
                          : styles.statusMedium
                    }
                  >
                    {statusLabel}
                  </RNText>
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  filtersContainer: {
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  filterSelect: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterSelectText: {
    fontSize: 14,
    color: colors.text,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metricPurple: {
    backgroundColor: colors.secondary,
  },
  metricGreen: {
    backgroundColor: colors.success,
  },
  metricBlue: {
    backgroundColor: colors.info,
  },
  metricLabel: {
    color: colors.primaryText,
    fontSize: 11,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  priceRangeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  priceRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceRangeLabel: {
    fontSize: 14,
    color: colors.mutedText,
  },
  priceRangeValue: {
    alignItems: 'flex-end',
  },
  priceRangePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  priceRangeSupermarket: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  itemAnalyzedCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  itemAnalyzedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemAnalyzedDesc: {
    fontSize: 13,
    color: colors.mutedText,
  },
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHeader: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeaderText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  emptyComparisonRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  emptyComparisonText: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  tableCellPrice: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  statusContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statusBest: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  statusWorst: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  statusMedium: {
    color: colors.mutedText,
    fontSize: 12,
  },
});
