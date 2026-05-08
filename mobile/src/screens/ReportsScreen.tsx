import React, { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReports, PeriodMode, CategoryWithDelta } from '../hooks/useReports';
import { formatMoney, getMonthName } from '../utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading, ErrorMessage, MonthYearPicker } from '../components';
import { toCsvRow } from '../lib/csvSecurity';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

// ↑ vermelho = gastou mais (ruim), ↓ verde = gastou menos (bom)
const DeltaBadge: React.FC<{ delta: number | null }> = ({ delta }) => {
  if (delta === null || delta === undefined) return null;
  const rounded = Math.round(Math.abs(delta));
  if (rounded === 0) return null;
  const isUp = delta > 0;
  return (
    <View style={isUp ? styles.badgeUp : styles.badgeDown}>
      <RNText style={styles.badgeText}>{isUp ? '↑' : '↓'} {rounded}%</RNText>
    </View>
  );
};

export const ReportsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    isLoading,
    error,
    periodMode,
    selectedMonth,
    selectedYear,
    heroValue,
    prevHeroValue,
    sparklineData,
    categoryData,
    supermarketData,
    topItems,
    itemReport,
    selectedItem,
    setPeriodMode,
    setSelectedMonth,
    setSelectedYear,
    setSelectedItem,
    loadItemReport,
    refresh,
  } = useReports();

  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  const [itemDetailVisible, setItemDetailVisible] = useState(false);
  const [itemDetailLoading, setItemDetailLoading] = useState(false);

  // Rótulos de período
  const periodLabel = periodMode === 'month'
    ? `${getMonthName(selectedMonth)} ${selectedYear}`
    : String(selectedYear);

  const prevPeriodLabel = periodMode === 'month'
    ? selectedMonth === 1
      ? `Dezembro ${selectedYear - 1}`
      : getMonthName(selectedMonth - 1)
    : String(selectedYear - 1);

  // Delta do hero
  const heroDelta = prevHeroValue > 0
    ? ((heroValue - prevHeroValue) / prevHeroValue) * 100
    : null;

  const handlePeriodPickerPress = () => {
    if (periodMode === 'month') setMonthPickerVisible(true);
    else setYearPickerVisible(true);
  };

  const handleTopItemPress = async (itemName: string) => {
    setSelectedItem(itemName);
    setItemDetailVisible(true);
    setItemDetailLoading(true);
    await loadItemReport(itemName);
    setItemDetailLoading(false);
  };

  const handleExportCSV = async () => {
    const csvString = periodMode === 'month'
      ? [
          toCsvRow(['Categoria', 'Total', 'Percentual']),
          ...categoryData.map(c => toCsvRow([c.category, c.total.toFixed(2), `${c.percentage.toFixed(1)}%`])),
        ].join('\n')
      : [
          toCsvRow(['Mes', 'Total']),
          ...sparklineData.map(m => toCsvRow([getMonthName(m.month), m.total.toFixed(2)])),
        ].join('\n');

    try {
      await Share.share({ message: csvString, title: 'relatorio.csv' });
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar o relatório.');
    }
  };

  // Dados do modal de item
  const itemReportData = itemReport ?? {
    totalQuantity: 0,
    totalSpent: 0,
    averagePrice: 0,
    purchaseCount: 0,
    bySupermarket: [] as Array<{ supermarket: string; averagePrice: number; totalQuantity: number; totalSpent: number }>,
  };
  const hasItemData = itemReportData.totalQuantity > 0;
  const comparisonPrices = itemReportData.bySupermarket.map(r => r.averagePrice).filter(p => p > 0);
  const minPrice = comparisonPrices.length > 0 ? Math.min(...comparisonPrices) : 0;
  const maxPrice = comparisonPrices.length > 0 ? Math.max(...comparisonPrices) : 0;

  // Dimensões calculadas para os gráficos
  const maxSparkline = Math.max(...sparklineData.map(d => d.total), 1);
  const maxCategoryTotal = categoryData.length > 0 ? Math.max(...categoryData.map(c => c.total)) : 1;
  const sortedMarkets = [...supermarketData].sort((a, b) => b.total - a.total);
  const maxMarketTotal = sortedMarkets.length > 0 ? sortedMarkets[0].total : 1;

  const isEmpty = !isLoading && heroValue === 0 && categoryData.length === 0 && topItems.length === 0;

  if (isLoading) return <Loading fullScreen />;
  if (error) return <ErrorMessage message={error} onRetry={refresh} />;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        {/* ── Seletor de modo ── */}
        <View style={styles.modeRow}>
          <View style={styles.modePills}>
            {(['month', 'year'] as PeriodMode[]).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.modePill, periodMode === mode && styles.modePillActive]}
                onPress={() => setPeriodMode(mode)}
              >
                <RNText style={[styles.modePillText, periodMode === mode && styles.modePillTextActive]}>
                  {mode === 'month' ? 'Mês' : 'Ano'}
                </RNText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modeRowRight}>
            <TouchableOpacity style={styles.periodButton} onPress={handlePeriodPickerPress}>
              <RNText style={styles.periodButtonText}>{periodLabel}</RNText>
              <MaterialCommunityIcons name="chevron-down" size={15} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExportCSV} style={styles.exportButton}>
              <MaterialCommunityIcons name="file-export-outline" size={20} color={colors.mutedText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero Card ── */}
        <View style={styles.heroCard}>
          <RNText style={styles.heroLabel}>
            {periodMode === 'month'
              ? `Gasto em ${getMonthName(selectedMonth)}`
              : `Total em ${selectedYear}`}
          </RNText>
          <RNText style={styles.heroValue}>{formatMoney(heroValue)}</RNText>

          {heroDelta !== null && (
            <View style={[
              styles.heroBadge,
              heroDelta > 0 ? styles.heroBadgeUp
              : heroDelta < 0 ? styles.heroBadgeDown
              : styles.heroBadgeNeutral,
            ]}>
              <RNText style={styles.heroBadgeText}>
                {heroDelta > 0 ? '↑' : '↓'} {Math.abs(Math.round(heroDelta))}% vs {prevPeriodLabel}
              </RNText>
            </View>
          )}

          {/* Sparkline inline no hero */}
          {sparklineData.length > 0 && (
            <View style={styles.sparkline}>
              {sparklineData.map((item, i) => {
                const h = Math.max((item.total / maxSparkline) * 44, item.total > 0 ? 4 : 0);
                const isHighlighted = periodMode === 'month' && item.month === selectedMonth;
                return (
                  <View key={i} style={styles.sparklineCol}>
                    <View
                      style={[
                        styles.sparklineBar,
                        {
                          height: h,
                          backgroundColor: isHighlighted
                            ? 'rgba(255,255,255,0.95)'
                            : 'rgba(255,255,255,0.28)',
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── No que você gastou? ── */}
        {categoryData.length > 0 && (
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>No que você gastou?</RNText>
            {categoryData.map((cat: CategoryWithDelta) => {
              const w = maxCategoryTotal > 0
                ? Math.min((cat.total / maxCategoryTotal) * 100, 100)
                : 0;
              return (
                <View key={cat.categoryId} style={styles.catRow}>
                  <View style={styles.catTopRow}>
                    <RNText style={styles.catName}>{cat.category}</RNText>
                    <View style={styles.catRight}>
                      <RNText style={styles.catTotal}>{formatMoney(cat.total)}</RNText>
                      <DeltaBadge delta={cat.delta} />
                    </View>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFillCategory, { width: `${w}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Onde você comprou? ── */}
        {sortedMarkets.length > 0 && (
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>Onde você comprou?</RNText>
            {sortedMarkets.map((market, i) => {
              const w = maxMarketTotal > 0
                ? Math.min((market.total / maxMarketTotal) * 100, 100)
                : 0;
              return (
                <View key={`${market.supermarket}-${i}`} style={styles.marketRow}>
                  <View style={styles.marketTopRow}>
                    <RNText style={styles.marketName}>{market.supermarket}</RNText>
                    <RNText style={styles.marketTotal}>{formatMoney(market.total)}</RNText>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFillMarket, { width: `${w}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Itens frequentes ── */}
        {topItems.length > 0 && (
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>Itens frequentes</RNText>
            <RNText style={styles.sectionHint}>Toque para ver preços por mercado</RNText>
            <View style={styles.itemsList}>
              {topItems.map((item, i) => (
                <TouchableOpacity
                  key={`${item.name}-${i}`}
                  style={[styles.itemRow, i === topItems.length - 1 && styles.itemRowLast]}
                  onPress={() => handleTopItemPress(item.name)}
                >
                  <View style={styles.itemInfo}>
                    <RNText style={styles.itemName} numberOfLines={1}>{item.name}</RNText>
                    <RNText style={styles.itemSub}>{item.quantity}x · {formatMoney(item.total)}</RNText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedText} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Estado vazio ── */}
        {isEmpty && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={56} color={colors.border} />
            <RNText style={styles.emptyTitle}>Sem dados para este período</RNText>
            <RNText style={styles.emptyHint}>Registre compras para ver seus relatórios aqui.</RNText>
            <TouchableOpacity
              style={styles.emptyCTA}
              onPress={() => navigation.navigate('ScanQRCode')}
            >
              <RNText style={styles.emptyCTAText}>Importar nota fiscal</RNText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Picker de mês */}
      <MonthYearPicker
        visible={monthPickerVisible}
        onClose={() => setMonthPickerVisible(false)}
        value={{ month: selectedMonth, year: selectedYear }}
        onChange={({ month, year }) => {
          setSelectedMonth(month);
          setSelectedYear(year);
          setMonthPickerVisible(false);
        }}
      />

      {/* Modal: seletor de ano */}
      <Modal
        visible={yearPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setYearPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle}>Selecionar Ano</RNText>
              <TouchableOpacity onPress={() => setYearPickerVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={YEAR_OPTIONS}
              keyExtractor={year => String(year)}
              renderItem={({ item: year }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedYear === year && styles.pickerItemSelected]}
                  onPress={() => {
                    setSelectedYear(year);
                    setYearPickerVisible(false);
                  }}
                >
                  <RNText style={[styles.pickerItemText, selectedYear === year && styles.pickerItemTextSelected]}>
                    {year}
                  </RNText>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal: detalhe do item (preços por mercado) */}
      <Modal
        visible={itemDetailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setItemDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.itemModalCard]}>
            <View style={styles.modalHeader}>
              <RNText style={styles.modalTitle} numberOfLines={1}>{selectedItem}</RNText>
              <TouchableOpacity onPress={() => setItemDetailVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {itemDetailLoading ? (
              <View style={styles.itemDetailLoading}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            ) : (
              <>
                <View style={styles.itemMetrics}>
                  <View style={[styles.itemMetricCard, { backgroundColor: colors.secondary }]}>
                    <RNText style={styles.itemMetricLabel}>Preço médio</RNText>
                    <RNText style={styles.itemMetricValue}>
                      {hasItemData ? formatMoney(itemReportData.averagePrice) : '-'}
                    </RNText>
                  </View>
                  <View style={[styles.itemMetricCard, { backgroundColor: colors.success }]}>
                    <RNText style={styles.itemMetricLabel}>Total gasto</RNText>
                    <RNText style={styles.itemMetricValue}>
                      {hasItemData ? formatMoney(itemReportData.totalSpent) : '-'}
                    </RNText>
                  </View>
                  <View style={[styles.itemMetricCard, { backgroundColor: colors.info }]}>
                    <RNText style={styles.itemMetricLabel}>Compras</RNText>
                    <RNText style={styles.itemMetricValue}>
                      {hasItemData ? `${itemReportData.purchaseCount}x` : '-'}
                    </RNText>
                  </View>
                </View>

                <View style={styles.tableHeader}>
                  <RNText style={styles.tableHeaderText}>Mercado</RNText>
                  <RNText style={styles.tableHeaderText}>Preço</RNText>
                  <RNText style={styles.tableHeaderText}>Status</RNText>
                </View>

                <FlatList
                  data={itemReportData.bySupermarket}
                  keyExtractor={(row, i) => `${row.supermarket}-${i}`}
                  ListEmptyComponent={
                    <View style={styles.tableEmpty}>
                      <RNText style={styles.tableEmptyText}>
                        Sem dados para este item no período.
                      </RNText>
                    </View>
                  }
                  renderItem={({ item: row, index }) => {
                    const isLast = index === itemReportData.bySupermarket.length - 1;
                    const hasMultiple = comparisonPrices.length > 1;
                    let statusLabel = 'Único';
                    let statusStyle = styles.statusNeutral;
                    if (hasMultiple) {
                      if (row.averagePrice === minPrice) {
                        statusLabel = 'Melhor preço';
                        statusStyle = styles.statusBest;
                      } else if (row.averagePrice === maxPrice) {
                        statusLabel = 'Mais caro';
                        statusStyle = styles.statusWorst;
                      } else {
                        statusLabel = 'Intermediário';
                      }
                    }
                    return (
                      <View style={[styles.tableRow, isLast && styles.tableRowLast]}>
                        <RNText style={styles.tableCell}>{row.supermarket}</RNText>
                        <RNText style={styles.tableCellPrice}>
                          {formatMoney(row.averagePrice)}
                        </RNText>
                        <View style={styles.statusContainer}>
                          <RNText style={statusStyle}>{statusLabel}</RNText>
                        </View>
                      </View>
                    );
                  }}
                />
              </>
            )}
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
    paddingBottom: 40,
  },
  // ── Seletor de modo ──
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButton: {
    padding: 4,
  },
  modePills: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modePill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modePillActive: {
    backgroundColor: colors.primary,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedText,
  },
  modePillTextActive: {
    color: colors.primaryText,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  // ── Hero Card ──
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginBottom: 6,
  },
  heroValue: {
    color: colors.primaryText,
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 16,
  },
  heroBadgeUp: {
    backgroundColor: 'rgba(255,59,48,0.25)',
  },
  heroBadgeDown: {
    backgroundColor: 'rgba(52,199,89,0.28)',
  },
  heroBadgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroBadgeText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
    gap: 3,
    marginTop: 4,
  },
  sparklineCol: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sparklineBar: {
    borderRadius: 2,
    minHeight: 0,
  },

  // ── Seções ──
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.mutedText,
    marginBottom: 12,
  },

  // Delta badges inline
  badgeUp: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeDown: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },

  // ── Categorias ──
  catRow: {
    marginTop: 10,
  },
  catTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  barTrack: {
    height: 7,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillCategory: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
  },

  // ── Mercados ──
  marketRow: {
    marginTop: 10,
  },
  marketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  marketName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  marketTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  barFillMarket: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },

  // ── Itens frequentes ──
  itemsList: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemRowLast: {},
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },

  // ── Estado vazio ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
  },
  emptyCTA: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  emptyCTAText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Modais ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '70%',
  },
  itemModalCard: {
    maxHeight: '82%',
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
    flex: 1,
    marginRight: 8,
  },
  pickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerItemTextSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },

  // ── Item detail modal ──
  itemDetailLoading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  itemMetrics: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  itemMetricCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  itemMetricLabel: {
    color: colors.primaryText,
    fontSize: 10,
    marginBottom: 3,
    textAlign: 'center',
  },
  itemMetricValue: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableHeader: {
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tableHeaderText: {
    color: colors.primaryText,
    fontSize: 12,
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
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  tableCellPrice: {
    fontSize: 13,
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
    fontWeight: '700',
  },
  statusWorst: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  statusNeutral: {
    color: colors.mutedText,
    fontSize: 12,
  },
  tableEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  tableEmptyText: {
    color: colors.mutedText,
    fontSize: 14,
    textAlign: 'center',
  },
});
