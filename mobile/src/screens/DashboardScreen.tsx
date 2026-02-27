import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useAuth } from '../context';
import { reportService } from '../services';
import { DashboardStats } from '../types';
import { formatMoney, getMonthName, getCurrentMonth, getCurrentYear } from '../utils';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { RootStackParamList, MainTabParamList } from '../types';
import { Header, MonthYearPicker } from '../components';
import { colors } from '../theme/colors';

type DashboardScreenProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'DashboardTab'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());

  useEffect(() => {
    loadDashboard();
  }, [selectedMonth, selectedYear]);

  const loadDashboard = async () => {
    try {
      const data = await reportService.getDashboardStats(selectedMonth, selectedYear);
      setStats(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickerChange = (value: { month: number; year: number }) => {
    setSelectedMonth(value.month);
    setSelectedYear(value.year);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header title="Início" iconName="view-dashboard" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Month Selector */}
        <TouchableOpacity style={styles.monthSelector} onPress={() => setShowPicker(true)}>
          <RNText style={styles.monthSelectorText}>
            {getMonthName(selectedMonth)} {selectedYear} ▼
          </RNText>
        </TouchableOpacity>

        {/* HERO - Main Metric */}
        <View style={styles.heroCard}>
          <RNText style={styles.heroLabel}>Gasto Total do Mês</RNText>
          <RNText style={styles.heroValue}>{formatMoney(stats?.totalSpent || 0)}</RNText>
          <View style={styles.heroBadge}>
            <RNText style={styles.heroBadgeText}>+12% vs mês anterior</RNText>
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
              <RNText style={styles.actionIcon}>🛒</RNText>
            </View>
            <View style={styles.actionContent}>
              <RNText style={styles.actionTitle}>Gerenciar Compras</RNText>
              <RNText style={styles.actionDesc}>Adicione novas notas fiscais</RNText>
            </View>
            <View style={styles.actionButton}>
              <RNText style={styles.actionButtonText}>+ Adicionar</RNText>
            </View>
          </TouchableOpacity>

          {/* Action 2 - Regra de 3 */}
          <TouchableOpacity 
            style={styles.actionCardSecondary}
            onPress={() => navigation.navigate('PurchasesTab')}
          >
            <View style={[styles.actionIconContainer, styles.actionIconBlue]}>
              <RNText style={styles.actionIcon}>📊</RNText>
            </View>
            <View style={styles.actionContent}>
              <RNText style={styles.actionTitleSecondary}>Regra de 3</RNText>
              <RNText style={styles.actionDescSecondary}>Compare preços entre mercados</RNText>
            </View>
          </TouchableOpacity>

          {/* Action 3 - Relatórios */}
          <TouchableOpacity 
            style={styles.actionCardSecondary}
            onPress={() => navigation.navigate('ReportsTab')}
          >
            <View style={[styles.actionIconContainer, styles.actionIconPurple]}>
              <RNText style={styles.actionIcon}>📈</RNText>
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
          
          <View style={styles.insightItem}>
            <RNText style={styles.insightIcon}>✓</RNText>
            <RNText style={styles.insightText}>Passarela Center teve melhores preços</RNText>
          </View>
          
          <View style={styles.insightItem}>
            <RNText style={styles.insightIcon}>✓</RNText>
            <RNText style={styles.insightText}>Arroz 5kg variou R$ 3,50 entre mercados</RNText>
          </View>
          
          <View style={styles.insightItem}>
            <RNText style={styles.insightIcon}>💡</RNText>
            <RNText style={styles.insightText}>Economia potencial: R$ 45,00/mês</RNText>
          </View>
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
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: '#fff',
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
    color: '#fff',
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
  actionIconPurple: {
    backgroundColor: colors.secondary,
  },
  actionIcon: {
    fontSize: 20,
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
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    color: colors.primaryText,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 10,
    overflow: 'hidden',
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: colors.mutedText,
  },
});
