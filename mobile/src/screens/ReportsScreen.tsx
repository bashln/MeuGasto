import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text as RNText,
  Alert,
  Share,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReports } from '../hooks/useReports';
import { useReportInsights } from '../features/reports/hooks/useReportInsights';
import { formatMoney, getMonthName } from '../utils';
import { Header, Loading, ErrorMessage } from '../components';
import { toCsvRow } from '../lib/csvSecurity';
import { colors } from '../theme/colors';
import { PeriodFilter } from '../features/reports/components/PeriodFilter';
import { InsightsBlock } from '../features/reports/components/InsightsBlock';
import { PriceHistoryChart } from '../features/reports/components/PriceHistoryChart';
import { MarketRanking, MarketSortBy } from '../features/reports/components/MarketRanking';
import { calculatePriceStats, formatPriceStats } from '../features/reports/utils/priceUtils';
import { MarketRankingItem } from '../features/reports/types';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

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
    selectedPeriod,
    selectedItem,
    monthlyData,
    supermarketData,
    topItems,
    itemReport,
    itemPriceHistory,
    setReportType,
    setSelectedYear,
    setSelectedPeriod,
    setSelectedItem,
    refresh,
  } = useReports();

  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [marketSortBy, setMarketSortBy] = useState<MarketSortBy>('averagePrice');
  const [marketSortDirection, setMarketSortDirection] = useState<'asc' | 'desc'>('asc');

  const itemReportData = itemReport ?? EMPTY_ITEM_REPORT;
  const hasItemData = itemReportData.totalQuantity > 0;

  const latestMonthInPeriod = useMemo(() => {
    if (monthlyData.length === 0) {
      return null;
    }

    return [...monthlyData].sort((left, right) => left.month - right.month)[monthlyData.length - 1] ?? null;
  }, [monthlyData]);
  const currentMonthValue = latestMonthInPeriod?.total ?? 0;
  const periodTotal = monthlyData.reduce((sum, month) => sum + month.total, 0);
  const totalItems = topItems.reduce((sum, item) => sum + item.quantity, 0);

  const priceStats = useMemo(() => calculatePriceStats(itemReportData), [itemReportData]);
  const formattedPriceStats = useMemo(() => formatPriceStats(priceStats), [priceStats]);

  const comparisonPrices = itemReportData.bySupermarket
    .map((row) => row.averagePrice)
    .filter((price) => price > 0);
  const minPrice = comparisonPrices.length > 0 ? Math.min(...comparisonPrices) : 0;
  const maxPrice = comparisonPrices.length > 0 ? Math.max(...comparisonPrices) : 0;

  const chartData = monthlyData.map((month) => ({
    month: getMonthName(month.month).substring(0, 3),
    value: month.total,
  }));

  const priceHistoryData = itemPriceHistory.map((historyPoint) => ({
    month: getMonthName(historyPoint.month).substring(0, 3),
    averagePrice: historyPoint.averagePrice,
  }));

  const marketRankingData = useMemo<MarketRankingItem[]>(() => {
    const positiveAverages = supermarketData
      .map((market) => market.averagePrice)
      .filter((averagePrice) => averagePrice > 0);
    const cheapestAverage = positiveAverages.length > 0 ? Math.min(...positiveAverages) : 0;

    return supermarketData.map((market) => {
      const potentialSavingsPerPurchase = Math.max(market.averagePrice - cheapestAverage, 0);
      return {
        supermarket: market.supermarket,
        averagePrice: market.averagePrice,
        totalSpent: market.total,
        purchaseCount: market.purchaseCount,
        potentialSavings: potentialSavingsPerPurchase * market.purchaseCount,
      };
    });
  }, [supermarketData]);

  const mercadoTotal = marketRankingData.reduce((sum, market) => sum + market.totalSpent, 0);
  const mercadoPurchases = marketRankingData.reduce((sum, market) => sum + market.purchaseCount, 0);
  const globalAverageTicket = mercadoPurchases > 0 ? mercadoTotal / mercadoPurchases : 0;

  const { insights, loading: insightsLoading } = useReportInsights({
    currentData:
      reportType === 'geral'
        ? monthlyData
        : reportType === 'itens'
          ? itemReportData
          : supermarketData,
    period: selectedPeriod,
    reportType,
    selectedItem,
    selectedYear,
  });

  const handleMarketSortChange = (nextSortBy: MarketSortBy) => {
    if (nextSortBy === marketSortBy) {
      setMarketSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setMarketSortBy(nextSortBy);
    setMarketSortDirection(nextSortBy === 'averagePrice' ? 'asc' : 'desc');
  };

  const handleExportCSV = async () => {
    let csvString = '';

    if (reportType === 'geral') {
      csvString = [
        toCsvRow(['Mes', 'Total']),
        ...monthlyData.map((month) => toCsvRow([getMonthName(month.month), month.total.toFixed(2)])),
      ].join('\n');
    } else if (reportType === 'itens') {
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
  };

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={refresh} />;
  }

  const renderGeralView = () => (
    <>
      {monthlyData.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.mutedText} />
          <RNText style={styles.emptyStateTitle}>Nenhum dado disponivel</RNText>
          <RNText style={styles.emptyStateSubtitle}>
            Nao ha gastos registrados no periodo selecionado. Tente ampliar o periodo de analise.
          </RNText>
        </View>
      ) : (
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
      )}
    </>
  );

  const renderItensView = () => (
    <>
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <RNText style={styles.filterLabel}>Item especifico</RNText>
          <TouchableOpacity style={styles.filterSelect} onPress={() => setItemPickerVisible(true)}>
            <RNText style={styles.filterSelectText}>{selectedItem || 'Nenhum item encontrado'}</RNText>
            <MaterialCommunityIcons name="chevron-down" size={14} color={colors.mutedText} />
          </TouchableOpacity>
        </View>
      </View>

      <InsightsBlock insights={insights} loading={insightsLoading} />

      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Preco medio</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? formatMoney(itemReportData.averagePrice) : 'Sem dados no periodo'}
          </RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Total gasto</RNText>
          <RNText style={styles.metricValue}>
            {hasItemData ? formatMoney(itemReportData.totalSpent) : 'Sem dados no periodo'}
          </RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Compras</RNText>
          <RNText style={styles.metricValue}>{hasItemData ? `${itemReportData.purchaseCount}x` : 'Sem dados'}</RNText>
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
            ? `Compras: ${itemReportData.purchaseCount} • Quantidade: ${itemReportData.totalQuantity} • Preco medio: ${formatMoney(itemReportData.averagePrice)}`
            : 'Dados insuficientes para este item. Tente selecionar outro item ou ampliar o periodo.'}
        </RNText>
      </View>

      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <RNText style={styles.tableHeaderText}>Mercado</RNText>
          <RNText style={styles.tableHeaderText}>Preco</RNText>
          <RNText style={styles.tableHeaderText}>Status</RNText>
        </View>

        {itemReportData.bySupermarket.length === 0 ? (
          <View style={styles.emptyComparisonRow}>
            <RNText style={styles.emptyComparisonText}>Nao ha dados suficientes para comparacao neste periodo.</RNText>
          </View>
        ) : (
          itemReportData.bySupermarket.map((row, index) => {
            const isLast = index === itemReportData.bySupermarket.length - 1;
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

  const renderMercadosView = () => (
    <>
      <InsightsBlock insights={insights} loading={insightsLoading} />

      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.metricPurple]}>
          <RNText style={styles.metricLabel}>Total geral</RNText>
          <RNText style={styles.metricValue}>{formatMoney(mercadoTotal)}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricGreen]}>
          <RNText style={styles.metricLabel}>Mercados</RNText>
          <RNText style={styles.metricValue}>{marketRankingData.length}</RNText>
        </View>
        <View style={[styles.metricCard, styles.metricBlue]}>
          <RNText style={styles.metricLabel}>Ticket medio geral</RNText>
          <RNText style={styles.metricValue}>{formatMoney(globalAverageTicket)}</RNText>
        </View>
      </View>

      <MarketRanking
        data={marketRankingData}
        sortBy={marketSortBy}
        sortDirection={marketSortDirection}
        onSortChange={handleMarketSortChange}
      />
    </>
  );

  return (
    <View style={styles.container}>
      <Header title="Relatorios" iconName="chart-bar" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, reportType === 'itens' && styles.segmentButtonActive]}
            onPress={() => setReportType('itens')}
          >
            <RNText style={[styles.segmentText, reportType === 'itens' && styles.segmentTextActive]}>Por item</RNText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, reportType === 'geral' && styles.segmentButtonActive]}
            onPress={() => setReportType('geral')}
          >
            <RNText style={[styles.segmentText, reportType === 'geral' && styles.segmentTextActive]}>Geral</RNText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, reportType === 'mercados' && styles.segmentButtonActive]}
            onPress={() => setReportType('mercados')}
          >
            <RNText style={[styles.segmentText, reportType === 'mercados' && styles.segmentTextActive]}>Mercados</RNText>
          </TouchableOpacity>
        </View>

        <View style={styles.yearSelector}>
          {YEAR_OPTIONS.map((year) => (
            <TouchableOpacity
              key={year}
              style={[styles.yearButton, selectedYear === year && styles.yearButtonSelected]}
              onPress={() => setSelectedYear(year)}
            >
              <RNText style={[styles.yearText, selectedYear === year && styles.yearTextSelected]}>{year}</RNText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.periodFilterContainer}>
          <PeriodFilter selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />
        </View>

        {reportType === 'geral' && renderGeralView()}
        {reportType === 'itens' && renderItensView()}
        {reportType === 'mercados' && renderMercadosView()}

        <View style={styles.exportCard}>
          <RNText style={styles.exportTitle}>Exportar relatorio</RNText>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={[styles.pdfButton, { opacity: 0.45 }]} disabled>
              <View style={styles.exportButtonContent}>
                <MaterialCommunityIcons
                  name="file-pdf-box"
                  size={18}
                  color={colors.primaryText}
                  style={styles.exportButtonIcon}
                />
                <RNText style={styles.exportButtonText}>PDF</RNText>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.excelButton} onPress={handleExportCSV}>
              <View style={styles.exportButtonContent}>
                <MaterialCommunityIcons
                  name="file-delimited"
                  size={18}
                  color={colors.primaryText}
                  style={styles.exportButtonIcon}
                />
                <RNText style={styles.exportButtonText}>CSV</RNText>
              </View>
            </TouchableOpacity>
          </View>
          <RNText style={styles.disabledHint}>PDF em breve.</RNText>
        </View>
      </ScrollView>

      <Modal
        visible={itemPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setItemPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Selecionar item</RNText>
              <TouchableOpacity onPress={() => setItemPickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={topItems}
              keyExtractor={(item) => item.name}
              style={styles.pickerList}
              ListEmptyComponent={
                <View style={styles.emptyPickerContainer}>
                  <RNText style={styles.emptyPickerText}>
                    Nenhum item com compras no periodo. Amplie o periodo ou ajuste o ano.
                  </RNText>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedItem === item.name && styles.pickerItemSelected]}
                  onPress={() => {
                    setSelectedItem(item.name);
                    setItemPickerVisible(false);
                  }}
                >
                  <RNText
                    style={[styles.pickerItemName, selectedItem === item.name && styles.pickerItemNameSelected]}
                  >
                    {item.name}
                  </RNText>
                  <RNText
                    style={[styles.pickerItemTotal, selectedItem === item.name && styles.pickerItemTotalSelected]}
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
  periodFilterContainer: {
    marginBottom: 16,
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
  exportButtonIcon: {
    marginRight: 6,
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
  emptyPickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  emptyPickerText: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
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
