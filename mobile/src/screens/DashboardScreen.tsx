import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboard } from '../hooks/useDashboard';
import { formatMoney, getMonthName } from '../utils';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { RootStackParamList, MainTabParamList } from '../navigation/types';
import { Header, MonthYearPicker, ErrorMessage } from '../components';
import { colors } from '../theme/colors';

type DashboardScreenProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'DashboardTab'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const {
    stats,
    topItems,
    supermarketData,
    monthlyTotals,
    previousYearMonthlyTotals,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    isLoading,
    error,
    refresh,
  } = useDashboard();

  const [showPicker, setShowPicker] = useState(false);

  const handlePickerChange = (value: { month: number; year: number }) => {
    setSelectedMonth(value.month);
    setSelectedYear(value.year);
    setShowPicker(false);
  };

  const currentMonthTotal =
    monthlyTotals.find(m => m.month === selectedMonth)?.total || 0;
  const previousMonthTotal =
    selectedMonth === 1
      ? previousYearMonthlyTotals.find(m => m.month === 12)?.total || 0
      : monthlyTotals.find(m => m.month === selectedMonth - 1)?.total || 0;
  let comparisonText = 'Sem base para comparação';
  let comparisonTone: 'positive' | 'negative' | 'neutral' = 'neutral';

  if (previousMonthTotal === 0) {
    if (currentMonthTotal > 0) {
      comparisonText = 'Início de registro neste mês';
    } else {
      comparisonText = 'Sem gastos neste e no mês anterior';
    }
  } else if (currentMonthTotal === 0) {
    comparisonText = '-100% vs mês anterior';
    comparisonTone = 'positive';
  } else {
    const comparisonPercent = Math.round(
      ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100,
    );
    comparisonText = `${comparisonPercent >= 0 ? '+' : ''}${comparisonPercent}% vs mês anterior`;

    if (comparisonPercent > 0) {
      comparisonTone = 'negative';
    } else if (comparisonPercent < 0) {
      comparisonTone = 'positive';
    }
  }

  const topItem = topItems[0];
  const topMarket = supermarketData
    .slice()
    .sort((a, b) => b.total - a.total)[0];
  const insights = [
    topItem ? `Item com maior gasto: ${topItem.name} (${formatMoney(topItem.total)})` : null,
    topMarket ? `Mercado com maior gasto: ${topMarket.supermarket} (${formatMoney(topMarket.total)})` : null,
    stats?.purchaseCount ? `Compras no mês: ${stats.purchaseCount}` : null,
  ].filter(Boolean) as string[];

  if (error) {
    return (
      <View style={styles.container}>
        <Header title="Início" iconName="view-dashboard" />
        <ErrorMessage message={error} onRetry={refresh} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header title="Início" iconName="view-dashboard" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      >
        {/* Month Selector */}
        <TouchableOpacity style={styles.monthSelector} onPress={() => setShowPicker(true)}>
          <RNText style={styles.monthSelectorText}>
            {getMonthName(selectedMonth)} {selectedYear}
          </RNText>
          <MaterialCommunityIcons name="chevron-down" size={14} color={colors.primary} />
        </TouchableOpacity>

        {/* HERO - Main Metric */}
        <View style={styles.heroCard}>
          <RNText style={styles.heroLabel}>Gasto Total do Mês</RNText>
          <RNText style={styles.heroValue}>{formatMoney(stats?.totalSpent || 0)}</RNText>
          <View
            style={[
              styles.heroBadge,
              comparisonTone === 'positive'
                ? styles.heroBadgePositive
                : comparisonTone === 'negative'
                  ? styles.heroBadgeNegative
                  : styles.heroBadgeNeutral,
            ]}
          >
            <RNText style={styles.heroBadgeText}>{comparisonText}</RNText>
          </View>
        </View>

        {/* Secondary Metrics - 2x2 Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, styles.metricGreen]}>
            <RNText style={styles.metricLabel}>Compras do mês</RNText>
            <RNText style={styles.metricValue}>{stats?.purchaseCount || 0}</RNText>
          </View>

          <View style={[styles.metricCard, styles.metricOrange]}>
            <RNText style={styles.metricLabel}>Itens únicos</RNText>
            <RNText style={styles.metricValue}>{stats?.itemCount || 0}</RNText>
          </View>

          <View style={[styles.metricCard, styles.metricPurple]}>
            <RNText style={styles.metricLabel}>Economia estimada</RNText>
            <RNText style={styles.metricValue}>{formatMoney(stats?.savings || 0)}</RNText>
          </View>

          <View style={[styles.metricCard, styles.metricBlue]}>
            <RNText style={styles.metricLabel}>Ticket médio</RNText>
            <RNText style={styles.metricValue}>
              {stats?.purchaseCount ? formatMoney(stats.totalSpent / stats.purchaseCount) : 'R$ 0,00'}
            </RNText>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <RNText style={styles.sectionTitle}>Ações Rápidas</RNText>

          {/* Action 1 - Gerenciar Compras (Primary) */}
          <TouchableOpacity
            style={styles.actionCardPrimary}
            onPress={() => navigation.navigate('ScanQRCode')}
          >
            <View style={styles.actionIconContainer}>
              <MaterialCommunityIcons name="cart" size={22} color={colors.primaryText} />
            </View>
            <View style={styles.actionContent}>
              <RNText style={styles.actionTitle}>Gerenciar Compras</RNText>
              <RNText style={styles.actionDesc}>Adicione novas notas fiscais</RNText>
            </View>
            <View style={styles.actionButton}>
              <RNText style={styles.actionButtonText}>+ Adicionar</RNText>
            </View>
          </TouchableOpacity>

          {/* Action 2 - Comparador de preços */}
          <TouchableOpacity
            style={styles.actionCardSecondary}
            onPress={() => navigation.navigate('PriceComparator')}
          >
            <View style={[styles.actionIconContainer, styles.actionIconGreen]}>
              <MaterialCommunityIcons name="scale-balance" size={22} color={colors.primaryText} />
            </View>
            <View style={styles.actionContent}>
              <RNText style={styles.actionTitleSecondary}>Comparador de Preços</RNText>
              <RNText style={styles.actionDescSecondary}>Compare itens em tempo real</RNText>
            </View>
          </TouchableOpacity>

          {/* Action 3 - Regra de 3 */}
          <TouchableOpacity
            style={styles.actionCardSecondary}
            onPress={() => navigation.navigate('PurchasesTab')}
          >
            <View style={[styles.actionIconContainer, styles.actionIconBlue]}>
              <MaterialCommunityIcons name="chart-bar" size={22} color={colors.primaryText} />
            </View>
            <View style={styles.actionContent}>
              <RNText style={styles.actionTitleSecondary}>Regra de 3</RNText>
              <RNText style={styles.actionDescSecondary}>Compare preços entre mercados</RNText>
            </View>
          </TouchableOpacity>

          {/* Action 4 - Relatórios */}
          <TouchableOpacity
            style={styles.actionCardSecondary}
            onPress={() => navigation.navigate('ReportsTab')}
          >
            <View style={[styles.actionIconContainer, styles.actionIconPurple]}>
              <MaterialCommunityIcons name="trending-up" size={22} color={colors.primaryText} />
            </View>
            <View style={styles.actionContent}>
              <RNText style={styles.actionTitleSecondary}>Relatórios</RNText>
              <RNText style={styles.actionDescSecondary}>Veja análises detalhadas</RNText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Insights */}
        <View style={styles.insightsCard}>
          <RNText style={styles.insightsTitle}>Insights deste mês</RNText>

          {insights.length === 0 ? (
            <RNText style={styles.insightEmptyText}>
              Sem dados suficientes para gerar insights neste período.
            </RNText>
          ) : (
            insights.map((insight, index) => (
              <View key={`${insight}-${index}`} style={styles.insightItem}>
                <View style={styles.insightIconContainer}>
                  <MaterialCommunityIcons
                    name={index === insights.length - 1 ? 'lightbulb-on-outline' : 'check'}
                    size={12}
                    color={colors.primaryText}
                  />
                </View>
                <RNText style={styles.insightText}>{insight}</RNText>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <MonthYearPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        value={{ month: selectedMonth, year: selectedYear }}
        onChange={handlePickerChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  monthSelector: {
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthSelectorText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  // HERO CARD
  heroCard: {
    backgroundColor: colors.info,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  heroValue: {
    color: colors.primaryText,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  heroBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  heroBadgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgePositive: {
    backgroundColor: 'rgba(30,142,62,0.28)',
  },
  heroBadgeNegative: {
    backgroundColor: 'rgba(255,59,48,0.28)',
  },
  heroBadgeText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  // METRICS GRID
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    minHeight: 90,
    justifyContent: 'center',
  },
  metricGreen: {
    backgroundColor: colors.success,
  },
  metricOrange: {
    backgroundColor: colors.primary,
  },
  metricPurple: {
    backgroundColor: colors.secondary,
  },
  metricBlue: {
    backgroundColor: colors.info,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  // ACTIONS
  actionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  actionCardPrimary: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIconBlue: {
    backgroundColor: colors.info,
  },
  actionIconGreen: {
    backgroundColor: colors.success,
  },
  actionIconPurple: {
    backgroundColor: colors.secondary,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionDesc: {
    fontSize: 13,
    color: colors.mutedText,
    marginTop: 2,
  },
  actionTitleSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  actionDescSecondary: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionButtonText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  actionCardSecondary: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.info,
  },
  // INSIGHTS
  insightsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  insightEmptyText: {
    fontSize: 13,
    color: colors.mutedText,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: colors.mutedText,
  },
});
