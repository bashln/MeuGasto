import React from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors } from '../../../theme/colors';

interface PriceHistoryPoint {
  month: string; // abbreviated month name (Jan, Feb, etc.)
  averagePrice: number;
}

interface PriceHistoryChartProps {
  data: PriceHistoryPoint[];
  forExport?: boolean;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ data, forExport = false }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <RNText style={styles.emptyText}>Dados insuficientes para gerar o gráfico</RNText>
      </View>
    );
  }

  return (
    <View style={[styles.container, forExport && styles.exportContainer]}>
      <LineChart
        data={data.map(point => ({
          value: Number(point.averagePrice.toFixed(2)),
          label: point.month,
        }))}
        areaChart
        startFillColor={colors.primary}
        endFillColor={colors.primary}
        startOpacity={0.2}
        endOpacity={0.05}
        color={colors.primary}
        thickness={3}
        dataPointsColor={colors.primary}
        dataPointsRadius={4}
        yAxisColor={colors.border}
        xAxisColor={colors.border}
        xAxisLabelTextStyle={styles.axisText}
        yAxisTextStyle={styles.axisText}
        hideRules
        noOfSections={4}
        maxValue={Math.max(...data.map(point => point.averagePrice), 1) * 1.1}
        width={forExport ? 280 : 300}
        height={180}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  exportContainer: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedText,
  },
  axisText: {
    color: colors.mutedText,
    fontSize: 10,
  },
});
