import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { InsightsBlock } from './InsightsBlock';
import { MarketRanking, MarketSortBy } from './MarketRanking';
import { colors } from '../../../theme/colors';
import { formatMoney } from '../../../utils';
import { MarketRankingItem } from '../types';

interface ReportsMarketSectionProps {
  supermarketData: Array<{
    supermarket: string;
    total: number;
    purchaseCount: number;
    averagePrice: number;
  }>;
  insights: Array<{ id: string; title: string; description: string; type: 'positive' | 'negative' | 'neutral' }>;
  insightsLoading: boolean;
}

export const ReportsMarketSection: React.FC<ReportsMarketSectionProps> = ({
  supermarketData,
  insights,
  insightsLoading,
}) => {
  const [marketSortBy, setMarketSortBy] = useState<MarketSortBy>('averagePrice');
  const [marketSortDirection, setMarketSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const handleMarketSortChange = (nextSortBy: MarketSortBy) => {
    if (nextSortBy === marketSortBy) {
      setMarketSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setMarketSortBy(nextSortBy);
    setMarketSortDirection(nextSortBy === 'averagePrice' ? 'asc' : 'desc');
  };

  return (
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
});
