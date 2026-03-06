import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text as RNText, Alert, Share, Modal, FlatList, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReports } from '../hooks/useReports';
import { formatMoney, getMonthName } from '../utils';
import { Header, Loading, ErrorMessage } from '../components';
import { toCsvRow } from '../lib/csvSecurity';
import { colors } from '../theme/colors';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const EMPTY_ITEM_REPORT = {
  totalQuantity: 0,
  totalSpent: 0,
  averagePrice: 0,
  purchaseCount: 0,
  bySupermarket: [] as Array<{ supermarket: string; averagePrice: number; totalQuantity: number; totalSpent: number }>,
};

export const ReportsScreen: React.FC = () => {
  const {
    isLoading,
    error,
    reportType,
    selectedYear,
    selectedItem,
    monthlyData,
    supermarketData,
    topItems,
    itemReport,
    setReportType,
    setSelectedYear,
    setSelectedItem,
    refresh,
  } = useReports();

  // TODO(vNext): reativar filtro de periodo de analise com opcoes dinamicas.
  const selectedMarket = 'Todos';
  const sortBy = 'Preço';
  const [itemPickerVisible, setItemPickerVisible] = useState(false);

  const handleExportCSV = async () => {
    let csvString = '';

    if (reportType === 'geral') {
      csvString = [
        toCsvRow(['Mes', 'Total']),
        ...monthlyData.map(m => toCsvRow([getMonthName(m.month), m.total.toFixed(2)])),
      ].join('\n');
    } else if (reportType === 'itens') {
      const itemReportData = itemReport || EMPTY_ITEM_REPORT;
      csvString = [
        toCsvRow(['Supermercado', 'Preco Medio', 'Qtd Total', 'Total Gasto']),
        ...itemReportData.bySupermarket.map(row =>
          toCsvRow([
            row.supermarket,
            row.averagePrice.toFixed(2),
            row.totalQuantity,
            row.totalSpent.toFixed(2),
          ])
        ),
      ].join('\n');
    } else if (reportType === 'mercados') {
      csvString = [
        toCsvRow(['Supermercado', 'Total']),
        ...supermarketData.map(s => toCsvRow([s.supermarket, s.total.toFixed(2)])),
      ].join('\n');
    }

    try {
      await Share.share({ message: csvString, title: 'relatorio.csv' });
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o relatório.');
    }
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={refresh} />;
  }

  // Métricas calculadas
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthData = monthlyData.find(m => m.month === currentMonth);
  const currentMonthValue = currentMonthData?.total || 0;

  const last6Months = monthlyData.slice(-6);
  const last6MonthsTotal = last6Months.reduce((sum, m) => sum + m.total, 0);

  const totalItems = topItems.reduce((sum, item) => sum + item.quantity, 0);

  const itemReportData = itemReport || EMPTY_ITEM_REPORT;

  const hasItemData = itemReportData.totalQuantity > 0;
  const comparisonPrices = itemReportData.bySupermarket
    .map(row => row.averagePrice)
    .filter(price => price > 0);
  const minPrice = comparisonPrices.length > 0 ? Math.min(...comparisonPrices) : 0;
  const maxPrice = comparisonPrices.length > 0 ? Math.max(...comparisonPrices) : 0;

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
          {(() => {
            const maxChartValue = Math.max(...chartData.map(d => d.value)) || 1;
            return chartData.map((item, index) => (
            <View key={index} style={styles.chartBarContainer}>
              <View style={styles.chartBarWrapper}>
                <View
                  style={[
                    styles.chartBar,
                    { height: `${Math.min((item.value / maxChartValue) * 100, 100)}%` }
                  ]}
                />
              </View>
              <RNText style={styles.chartLabel}>{item.month}</RNText>
            </View>
          ));
          })()}
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
          <RNText style={styles.summaryLabel}>Meses com compras</RNText>
          <RNText style={styles.summaryValue}>{monthlyData.reduce((s, m) => s + m.total, 0) > 0 ? monthlyData.filter(m => m.total > 0).length : 0}</RNText>
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
          <TouchableOpacity
            style={styles.filterSelect}
            onPress={() => setItemPickerVisible(true)}
          >
            <RNText style={styles.filterSelectText}>
              {selectedItem || 'Nenhum item encontrado'}
            </RNText>
            <MaterialCommunityIcons name="chevron-down" size={14} color={colors.mutedText} />
          </TouchableOpacity>
        </View>

        {/*
          TODO(vNext): reativar filtro de periodo de analise.
          <View style={styles.filterRow}>
            <RNText style={styles.filterLabel}>Período de Análise</RNText>
            <View style={styles.filterSelect}>
              <RNText style={styles.filterSelectText}>{selectedPeriod}</RNText>
            </View>
          </View>
        */}

        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Mercado</RNText>
          <View style={styles.filterSelect}>
            <RNText style={styles.filterSelectText}>{selectedMarket}</RNText>
          </View>
        </View>

        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Ordenar por</RNText>
          <View style={styles.filterSelect}>
            <RNText style={styles.filterSelectText}>{sortBy}</RNText>
          </View>
        </View>
      </View>

      {/* Métricas */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Preço médio</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? formatMoney(itemReportData.averagePrice) : 'Sem dados'}
          </RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Total gasto</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? formatMoney(itemReportData.totalSpent) : 'Sem dados'}
          </RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Compras</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? `${itemReportData.purchaseCount}x` : 'Sem dados'}
          </RNText>
        </View>
      </View>

      {/* Item Analisado */}
      <View style={styles.itemAnalyzedCard}>
        <RNText style={styles.itemAnalyzedTitle}>
          {selectedItem || 'Item selecionado'}
        </RNText>
        <RNText style={styles.itemAnalyzedDesc}>
          {hasItemData
            ? `Compras registradas: ${itemReportData.purchaseCount} • Quantidade: ${itemReportData.totalQuantity} • Preço médio: ${formatMoney(itemReportData.averagePrice)}`
            : 'Sem dados suficientes para comparar este item no período selecionado.'}
        </RNText>
      </View>

      {/* Tabela Comparativa */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <RNText style={styles.tableHeaderText}>Mercado</RNText>
          <RNText style={styles.tableHeaderText}>Preço</RNText>
          <RNText style={styles.tableHeaderText}>Status</RNText>
        </View>

        {itemReportData.bySupermarket.length === 0 ? (
          <View style={styles.emptyComparisonRow}>
            <RNText style={styles.emptyComparisonText}>
              Sem dados suficientes para comparação neste período.
            </RNText>
          </View>
        ) : (
          itemReportData.bySupermarket.map((row, index) => {
            const isLast = index === itemReportData.bySupermarket.length - 1;
            const hasMultiple = comparisonPrices.length > 1;
            let statusLabel = '-';
            if (hasMultiple) {
              if (row.averagePrice === minPrice) statusLabel = 'Melhor preço';
              else if (row.averagePrice === maxPrice) statusLabel = 'Mais caro';
            } else {
              statusLabel = 'Único';
            }

            return (
              <View
                key={`${row.supermarket}-${index}`}
                style={[styles.tableRow, isLast && styles.tableRowLast]}
              >
                <RNText style={styles.tableCell}>{row.supermarket}</RNText>
                <RNText style={styles.tableCellPrice}>
                  {formatMoney(row.averagePrice)}
                </RNText>
                <View style={styles.statusContainer}>
                  <RNText style={
                    statusLabel === 'Melhor preço' ? styles.statusBest
                    : statusLabel === 'Mais caro' ? styles.statusWorst
                    : styles.statusMedium
                  }>{statusLabel}</RNText>
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );

  const renderMercadosView = () => {
    const sorted = [...supermarketData].sort((a, b) => b.total - a.total);
    const grandTotal = sorted.reduce((sum, s) => sum + s.total, 0);
    const maxTotal = sorted.length > 0 ? sorted[0].total : 0;

    return (
      <>
        <View style={styles.metricsContainer}>
          <View style={[styles.metricCard, { backgroundColor: colors.primary }]}>
            <RNText style={styles.metricLabel}>Total Geral</RNText>
            <RNText style={styles.metricValue}>{formatMoney(grandTotal)}</RNText>
          </View>
          <View style={[styles.metricCard, styles.metricBlue]}>
            <RNText style={styles.metricLabel}>Mercados</RNText>
            <RNText style={styles.metricValue}>{sorted.length}</RNText>
          </View>
        </View>

        <View style={styles.tableCard}>
          {sorted.length === 0 ? (
            <View style={styles.emptyComparisonRow}>
              <RNText style={styles.emptyComparisonText}>Nenhum dado disponível.</RNText>
            </View>
          ) : (
            sorted.map((item, index) => {
              const widthPercent = maxTotal > 0
                ? Math.min((item.total / maxTotal) * 100, 100)
                : 0;

              return (
              <View
                key={`${item.supermarket}-${index}`}
                style={[styles.mercadoRow, index === sorted.length - 1 && styles.tableRowLast]}
              >
                <View style={styles.mercadoRowTop}>
                  <RNText style={styles.mercadoName}>{item.supermarket}</RNText>
                  <RNText style={styles.mercadoTotal}>{formatMoney(item.total)}</RNText>
                </View>
                <View style={styles.mercadoBarContainer}>
                  <View style={[styles.mercadoBar, { width: `${widthPercent}%` }]} />
                </View>
              </View>
              );
            })
          )}
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Header title="Relatórios" iconName="chart-bar" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      >
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
          <TouchableOpacity
            style={[styles.segmentButton, reportType === 'mercados' && styles.segmentButtonActive]}
            onPress={() => setReportType('mercados')}
          >
            <RNText style={[styles.segmentText, reportType === 'mercados' && styles.segmentTextActive]}>
              Mercados
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
        {reportType === 'geral' && renderGeralView()}
        {reportType === 'itens' && renderItensView()}
        {reportType === 'mercados' && renderMercadosView()}

        {/* Exportação */}
        <View style={styles.exportCard}>
          <RNText style={styles.exportTitle}>Exportar Relatório</RNText>
          <View style={styles.exportButtons}>
            <TouchableOpacity
              style={[styles.pdfButton, { opacity: 0.45 }]}
              disabled={true}
            >
              <View style={styles.exportButtonContent}>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color={colors.primaryText} style={{ marginRight: 6 }} />
                <RNText style={styles.exportButtonText}>PDF</RNText>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.excelButton}
              onPress={handleExportCSV}
            >
              <View style={styles.exportButtonContent}>
                <MaterialCommunityIcons name="file-delimited" size={18} color={colors.primaryText} style={{ marginRight: 6 }} />
                <RNText style={styles.exportButtonText}>CSV</RNText>
              </View>
            </TouchableOpacity>
          </View>
          <RNText style={styles.disabledHint}>PDF em breve.</RNText>
        </View>
      </ScrollView>

      {/* Modal: Item Picker */}
      <Modal
        visible={itemPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setItemPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Selecionar Item</RNText>
              <TouchableOpacity onPress={() => setItemPickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={topItems}
              keyExtractor={(item) => item.name}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedItem === item.name && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedItem(item.name);
                    setItemPickerVisible(false);
                  }}
                >
                  <RNText
                    style={[
                      styles.pickerItemName,
                      selectedItem === item.name && styles.pickerItemNameSelected,
                    ]}
                  >
                    {item.name}
                  </RNText>
                  <RNText
                    style={[
                      styles.pickerItemTotal,
                      selectedItem === item.name && styles.pickerItemTotalSelected,
                    ]}
                  >
                    {formatMoney(item.total)}
                  </RNText>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    gap: 8,
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
    fontSize: 13,
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
  exportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  disabledHint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.mutedText,
  },
  // Mercados view
  mercadoRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mercadoRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mercadoName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  mercadoTotal: {
    fontSize: 14,
    color: colors.mutedText,
    fontWeight: '500',
  },
  mercadoBarContainer: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  mercadoBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  // Item picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  pickerList: {
    marginBottom: 20,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary,
  },
  pickerItemName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  pickerItemNameSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  pickerItemTotal: {
    fontSize: 14,
    color: colors.mutedText,
  },
  pickerItemTotalSelected: {
    color: colors.primaryText,
  },
});
