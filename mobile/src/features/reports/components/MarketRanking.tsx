import React from 'react';
import { View, Text as RNText, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { formatMoney } from '../../../utils';
import { MarketRankingItem } from '../types';

export type MarketSortBy = 'averagePrice' | 'totalSpent' | 'purchaseCount';

interface MarketRankingProps {
  data: MarketRankingItem[];
  sortBy: MarketSortBy;
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortBy: MarketSortBy) => void;
  forExport?: boolean;
}

const SORT_LABELS: Record<MarketSortBy, string> = {
  averagePrice: 'Preco medio',
  totalSpent: 'Gasto total',
  purchaseCount: 'Compras',
};

export const MarketRanking: React.FC<MarketRankingProps> = ({
  data,
  sortBy,
  sortDirection,
  onSortChange,
  forExport = false,
}) => {
  const sortedData = [...data].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    const comparison = leftValue - rightValue;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (sortedData.length === 0) {
    return (
      <View style={styles.emptyState}>
        <RNText style={styles.emptyText}>Nenhum mercado encontrado no periodo selecionado.</RNText>
      </View>
    );
  }

  return (
    <View style={[styles.container, forExport && styles.exportContainer]}>
      {!forExport && (
        <View style={styles.sortControls}>
          {(Object.keys(SORT_LABELS) as MarketSortBy[]).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.sortButton, sortBy === option && styles.sortButtonActive]}
              onPress={() => onSortChange(option)}
            >
              <RNText style={[styles.sortButtonText, sortBy === option && styles.sortButtonTextActive]}>
                {SORT_LABELS[option]}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {sortedData.map((item, index) => (
        <View key={item.supermarket} style={[styles.row, index === sortedData.length - 1 && styles.rowLast]}>
          <View style={styles.rowLeft}>
            <RNText style={styles.position}>#{index + 1}</RNText>
            <View>
              <RNText style={styles.marketName}>{item.supermarket}</RNText>
              <RNText style={styles.averagePrice}>Ticket medio: {formatMoney(item.averagePrice)}</RNText>
            </View>
          </View>
          <View style={styles.rowRight}>
            <RNText style={styles.mainValue}>{formatMoney(item.totalSpent)}</RNText>
            <RNText style={styles.metaText}>{item.purchaseCount} compras</RNText>
            <RNText style={[styles.metaText, item.potentialSavings > 0 && styles.savingsText]}>
              {item.potentialSavings > 0
                ? `Economia potencial: ${formatMoney(item.potentialSavings)}`
                : 'Mercado mais barato'}
            </RNText>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  exportContainer: {
    borderRadius: 0,
    marginBottom: 0,
  },
  sortControls: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
  },
  sortButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: colors.primaryText,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  position: {
    fontSize: 12,
    color: colors.mutedText,
    width: 28,
  },
  marketName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  averagePrice: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  mainValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
    color: colors.mutedText,
    marginTop: 2,
  },
  savingsText: {
    color: colors.success,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: 'center',
  },
});
