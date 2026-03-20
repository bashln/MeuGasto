import React, { useMemo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InsightsBlock } from './InsightsBlock';
import { colors } from '../../../theme/colors';
import { formatMoney, getMonthName } from '../../../utils';

interface ReportsGeneralSectionProps {
  monthlyData: Array<{ month: number; total: number }>;
  topItems: Array<{ name: string; quantity: number; total: number; percentage: number }>;
  insights: Array<{ id: string; title: string; description: string; type: 'positive' | 'negative' | 'neutral' }>;
  insightsLoading: boolean;
}

export const ReportsGeneralSection: React.FC<ReportsGeneralSectionProps> = ({
  monthlyData,
  topItems,
  insights,
  insightsLoading,
}) => {
  const latestMonthInPeriod = useMemo(() => {
    if (monthlyData.length === 0) {
      return null;
    }

    return [...monthlyData].sort((left, right) => left.month - right.month)[monthlyData.length - 1] ?? null;
  }, [monthlyData]);

  const currentMonthValue = latestMonthInPeriod?.total ?? 0;
  const periodTotal = monthlyData.reduce((sum, month) => sum + month.total, 0);
  const totalItems = topItems.reduce((sum, item) => sum + item.quantity, 0);
  const chartData = monthlyData.map((month) => ({
    month: getMonthName(month.month).substring(0, 3),
    value: month.total,
  }));

  if (monthlyData.length === 0) {
    return (
      <View style={styles.emptyStateContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.mutedText} />
        <RNText style={styles.emptyStateTitle}>Nenhum dado disponivel</RNText>
        <RNText style={styles.emptyStateSubtitle}>
          Nao ha gastos registrados no periodo selecionado. Tente ampliar o periodo de analise.
        </RNText>
      </View>
    );
  }

  return (
    <>
      <InsightsBlock insights={insights} loading={insightsLoading} />

      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Gasto no ultimo mes</RNText>
          <RNText style={styles.metricValue}>{formatMoney(currentMonthValue)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Total no periodo</RNText>
          <RNText style={styles.metricValue}>{formatMoney(periodTotal)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Itens no periodo</RNText>
          <RNText style={styles.metricValue}>{totalItems}</RNText>
        </View>
      </View>

      <View style={styles.topItemsContainer}>
        <RNText style={styles.topItemsTitle}>Top itens que mais consomem</RNText>
        {topItems.length === 0 ? (
          <View style={styles.emptyComparisonRow}>
            <RNText style={styles.emptyComparisonText}>Sem itens no periodo selecionado.</RNText>
          </View>
        ) : (
          <View style={styles.topItemsList}>
            {topItems.slice(0, 5).map((item, index) => (
              <View key={item.name} style={styles.topItemsRow}>
                <View style={styles.topItemsLeft}>
                  <RNText style={styles.topItemsNumber}>#{index + 1}</RNText>
                  <RNText style={styles.topItemsName}>{item.name}</RNText>
                </View>
                <View style={styles.topItemsRight}>
                  <RNText style={styles.topItemsValue}>{formatMoney(item.total)}</RNText>
                  <View style={styles.topItemsProgressContainer}>
                    <View style={[styles.topItemsProgressBar, { width: `${Math.min(item.percentage, 100)}%` }]} />
                  </View>
                  <RNText style={styles.topItemsPercentage}>{item.percentage.toFixed(1)}%</RNText>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.chartCard}>
        <RNText style={styles.chartTitle}>Evolucao de gastos</RNText>
        <View style={styles.chartArea}>
          {(() => {
            const maxChartValue = Math.max(...chartData.map((item) => item.value), 1);
            return chartData.map((item) => (
              <View key={item.month} style={styles.chartBarContainer}>
                <View style={styles.chartBarWrapper}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: `${Math.min((item.value / maxChartValue) * 100, 100)}%` },
                    ]}
                  />
                </View>
                <RNText style={styles.chartLabel}>{item.month}</RNText>
              </View>
            ));
          })()}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
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
  topItemsContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  topItemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  topItemsList: {
    gap: 12,
  },
  topItemsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  topItemsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  topItemsNumber: {
    fontSize: 12,
    color: colors.mutedText,
    width: 24,
  },
  topItemsName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  topItemsRight: {
    width: 120,
    alignItems: 'flex-end',
  },
  topItemsValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  topItemsProgressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  topItemsProgressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  topItemsPercentage: {
    fontSize: 11,
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
  chartArea: {
    flexDirection: 'row',
    height: 160,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 6,
  },
  chartBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarWrapper: {
    height: 120,
    width: 24,
    backgroundColor: colors.border,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: colors.mutedText,
    marginTop: 4,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    color: colors.text,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
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
});
