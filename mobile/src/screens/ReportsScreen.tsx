import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text as RNText,
  RefreshControl,
} from 'react-native';
import { Header, Loading, ErrorMessage } from '../components';
import { colors } from '../theme/colors';
import {
  PeriodFilter,
  ReportsExportCard,
  ReportsGeneralSection,
  ReportsItemPickerModal,
  ReportsItemSection,
  ReportsMarketSection,
  useReportsScreenModel,
} from '../features/reports';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);

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
    itemPriceHistory,
    setReportType,
    setSelectedYear,
    setSelectedPeriod,
    setSelectedItem,
    refresh,
    itemReportData,
    insights,
    insightsLoading,
    handleExportCSV,
  } = useReportsScreenModel();

  const [itemPickerVisible, setItemPickerVisible] = useState(false);

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={refresh} />;
  }

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

        {reportType === 'geral' && (
          <ReportsGeneralSection
            monthlyData={monthlyData}
            topItems={topItems}
            insights={insights}
            insightsLoading={insightsLoading}
          />
        )}
        {reportType === 'itens' && (
          <ReportsItemSection
            selectedItem={selectedItem}
            itemReport={itemReportData}
            itemPriceHistory={itemPriceHistory}
            insights={insights}
            insightsLoading={insightsLoading}
            onOpenItemPicker={() => setItemPickerVisible(true)}
          />
        )}
        {reportType === 'mercados' && (
          <ReportsMarketSection
            supermarketData={supermarketData}
            insights={insights}
            insightsLoading={insightsLoading}
          />
        )}

        <ReportsExportCard onExportCSV={handleExportCSV} />
      </ScrollView>

      <ReportsItemPickerModal
        visible={itemPickerVisible}
        topItems={topItems}
        selectedItem={selectedItem}
        onClose={() => setItemPickerVisible(false)}
        onSelectItem={(itemName) => {
          setSelectedItem(itemName);
          setItemPickerVisible(false);
        }}
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
});
