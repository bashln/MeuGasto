import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { reportService } from '../services';
import { formatMoney, getMonthName, getCurrentYear } from '../utils';
import { Header, Loading, ErrorMessage } from '../components';
import { colors } from '../theme/colors';

type ReportType = 'geral' | 'itens';

const YEAR_OPTIONS = [2023, 2024, 2025, 2026, 2027];

// Dados de exemplo para tabela comparativa
const SAMPLE_COMPARISON_DATA = [
  { mercado: 'Passarela Center', preco: 18.45, status: 'melhor' },
  { mercado: 'Carrefour', preco: 19.90, status: 'medio' },
  { mercado: 'Extra', preco: 21.50, status: 'caro' },
  { mercado: 'Walmart', preco: 20.00, status: 'medio' },
];

export const ReportsScreen: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('itens');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: number; total: number }>>([]);
  const [supermarketData, setSupermarketData] = useState<Array<{ supermarket: string; total: number }>>([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; total: number }>>([]);
  
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedItem, setSelectedItem] = useState('Arroz 5kg');
  const [selectedPeriod, setSelectedPeriod] = useState('Últimos 6 meses');
  const [selectedMarket, setSelectedMarket] = useState('Todos');
  const [sortBy, setSortBy] = useState('Preço');

  useEffect(() => {
    loadReport();
  }, [reportType, selectedYear]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    try {
      if (reportType === 'geral') {
        const data = await reportService.getMonthlyExpenses(selectedYear);
        setMonthlyData(data);
      } else {
        const data = await reportService.getTopItems(10, startDate, endDate);
        setTopItems(data);
      }
      
      const superData = await reportService.getExpensesBySupermarket(startDate, endDate);
      setSupermarketData(superData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar relatório');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadReport} />;
  }

  // Métricas calculadas
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthData = monthlyData.find(m => m.month === currentMonth);
  const currentMonthValue = currentMonthData?.total || 0;
  
  const last6Months = monthlyData.slice(-6);
  const last6MonthsTotal = last6Months.reduce((sum, m) => sum + m.total, 0);
  
  const totalItems = topItems.reduce((sum, item) => sum + item.quantity, 0);

  // Dados do gráfico (simplificado)
  const chartData = monthlyData.map(m => ({
    month: getMonthName(m.month).substring(0, 3),
    value: m.total
  }));

  const renderGeralView = () => (
    <>
      {/* Métricas */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Gasto este mês</RNText>
          <RNText style={styles.metricValue}>{formatMoney(currentMonthValue)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Total 6 meses</RNText>
          <RNText style={styles.metricValue}>{formatMoney(last6MonthsTotal)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Itens analisados</RNText>
          <RNText style={styles.metricValue}>{totalItems}</RNText>
        </View>
      </View>

      {/* Gráfico Simplificado */}
      <View style={styles.chartCard}>
        <RNText style={styles.chartTitle}>Evolução de Gastos</RNText>
        <View style={styles.chartArea}>
          {chartData.map((item, index) => (
            <View key={index} style={styles.chartBarContainer}>
              <View style={styles.chartBarWrapper}>
                <View 
                  style={[
                    styles.chartBar, 
                    { height: `${Math.min((item.value / (Math.max(...chartData.map(d => d.value)) || 1)) * 100, 100)}%` }
                  ]} 
                />
              </View>
              <RNText style={styles.chartLabel}>{item.month}</RNText>
            </View>
          ))}
        </View>
      </View>

      {/* Resumo do Pedido */}
      <View style={styles.summaryCard}>
        <RNText style={styles.summaryTitle}>Resumo do Período</RNText>
        
        <View style={styles.summaryRow}>
          <RNText style={styles.summaryLabel}>Maior gasto</RNText>
          <RNText style={styles.summaryValue}>
            {formatMoney(Math.max(...monthlyData.map(m => m.total), 0))}
          </RNText>
        </View>
        
        <View style={styles.summaryRow}>
          <RNText style={styles.summaryLabel}>Menor gasto</RNText>
          <RNText style={styles.summaryValue}>
            {formatMoney(Math.min(...monthlyData.filter(m => m.total > 0).map(m => m.total), 0))}
          </RNText>
        </View>
        
        <View style={styles.summaryRow}>
          <RNText style={styles.summaryLabel}>Média mensal</RNText>
          <RNText style={styles.summaryValue}>
            {formatMoney(monthlyData.length > 0 ? monthlyData.reduce((s, m) => s + m.total, 0) / monthlyData.length : 0)}
          </RNText>
        </View>
        
        <View style={styles.summaryRow}>
          <RNText style={styles.summaryLabel}>Total de compras</RNText>
          <RNText style={styles.summaryValue}>{supermarketData.reduce((s, m) => s + 1, 0)}</RNText>
        </View>
      </View>
    </>
  );

  const renderItensView = () => (
    <>
      {/* Filtros para Por Item */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Item Específico</RNText>
          <View style={styles.filterSelect}>
            <RNText style={styles.filterSelectText}>{selectedItem}</RNText>
            <RNText style={styles.filterIcon}>▼</RNText>
          </View>
        </View>

        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Período de Análise</RNText>
          <View style={styles.filterSelect}>
            <RNText style={styles.filterSelectText}>{selectedPeriod}</RNText>
            <RNText style={styles.filterIcon}>▼</RNText>
          </View>
        </View>

        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Mercado</RNText>
          <View style={styles.filterSelect}>
            <RNText style={styles.filterSelectText}>{selectedMarket}</RNText>
            <RNText style={styles.filterIcon}>▼</RNText>
          </View>
        </View>

        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Ordenar por</RNText>
          <View style={styles.filterSelect}>
            <RNText style={styles.filterSelectText}>{sortBy}</RNText>
            <RNText style={styles.filterIcon}>▼</RNText>
          </View>
        </View>
      </View>

      {/* Métricas */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Preço médio</RNText>
          <RNText style={styles.metricValue}>R$ 18,45</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Total gasto</RNText>
          <RNText style={styles.metricValue}>R$ 221,40</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Compras</RNText>
          <RNText style={styles.metricValue}>12x</RNText>
        </View>
      </View>

      {/* Item Analisado */}
      <View style={styles.itemAnalyzedCard}>
        <RNText style={styles.itemAnalyzedTitle}>Arroz 5kg</RNText>
        <RNText style={styles.itemAnalyzedDesc}>
          Comprado a cada 2 semana(s) • 12 compras registradas • Preço médio: R$ 18,45
        </RNText>
      </View>

      {/* Tabela Comparativa */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <RNText style={styles.tableHeaderText}>Mercado</RNText>
          <RNText style={styles.tableHeaderText}>Preço</RNText>
          <RNText style={styles.tableHeaderText}>Status</RNText>
        </View>

        {SAMPLE_COMPARISON_DATA.map((row, index) => (
          <View 
            key={index} 
            style={[
              styles.tableRow,
              index === SAMPLE_COMPARISON_DATA.length - 1 && styles.tableRowLast
            ]}
          >
            <RNText style={styles.tableCell}>{row.mercado}</RNText>
            <RNText style={styles.tableCellPrice}>{formatMoney(row.preco)}</RNText>
            <View style={styles.statusContainer}>
              {row.status === 'melhor' && (
                <RNText style={styles.statusBest}>Melhor preço</RNText>
              )}
              {row.status === 'caro' && (
                <RNText style={styles.statusWorst}>Mais caro</RNText>
              )}
              {row.status === 'medio' && (
                <RNText style={styles.statusMedium}>-</RNText>
              )}
            </View>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header title="Relatórios" iconName="chart-bar" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity 
            style={[styles.segmentButton, reportType === 'itens' && styles.segmentButtonActive]}
            onPress={() => setReportType('itens')}
          >
            <RNText style={[styles.segmentText, reportType === 'itens' && styles.segmentTextActive]}>
              Por Item
            </RNText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.segmentButton, reportType === 'geral' && styles.segmentButtonActive]}
            onPress={() => setReportType('geral')}
          >
            <RNText style={[styles.segmentText, reportType === 'geral' && styles.segmentTextActive]}>
              Geral
            </RNText>
          </TouchableOpacity>
        </View>

        {/* Seletor de Ano */}
        <View style={styles.yearSelector}>
          {YEAR_OPTIONS.map((year) => (
            <TouchableOpacity
              key={year}
              style={[
                styles.yearButton,
                selectedYear === year && styles.yearButtonSelected,
              ]}
              onPress={() => setSelectedYear(year)}
            >
              <RNText
                style={[
                  styles.yearText,
                  selectedYear === year && styles.yearTextSelected,
                ]}
              >
                {year}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Conteúdo baseado no tipo */}
        {reportType === 'geral' ? renderGeralView() : renderItensView()}

        {/* Exportação */}
        <View style={styles.exportCard}>
          <RNText style={styles.exportTitle}>Exportar Relatório</RNText>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={styles.pdfButton}>
              <RNText style={styles.exportButtonText}>📄 PDF</RNText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.excelButton}>
              <RNText style={styles.exportButtonText}>📊 Excel</RNText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  segmentTextActive: {
    color: colors.primaryText,
  },
  yearSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  yearButtonSelected: {
    backgroundColor: colors.primary,
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  yearTextSelected: {
    color: colors.primaryText,
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.mutedText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
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
  filterIcon: {
    fontSize: 12,
    color: colors.mutedText,
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
  exportCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 100,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pdfButton: {
    flex: 1,
    backgroundColor: colors.info,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  excelButton: {
    flex: 1,
    backgroundColor: colors.success,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '500',
  },
});
