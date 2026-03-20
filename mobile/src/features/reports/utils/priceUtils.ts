import { formatMoney } from '../../../utils';

interface PriceStats {
  minPrice: number;
  maxPrice: number;
  minPriceSupermarket: string;
  maxPriceSupermarket: string;
  averagePrice: number;
  totalQuantity: number;
  totalSpent: number;
  purchaseCount: number;
  trend: 'up' | 'stable' | 'down';
}

interface ItemReportInput {
  averagePrice?: number;
  totalQuantity?: number;
  totalSpent?: number;
  purchaseCount?: number;
  bySupermarket?: Array<{
    supermarket: string;
    averagePrice: number;
  }>;
}

/**
 * Calculate price statistics for an item report
 */
export const calculatePriceStats = (itemReport: ItemReportInput): PriceStats => {
  if (!itemReport || !itemReport.bySupermarket || itemReport.bySupermarket.length === 0) {
    return {
      minPrice: 0,
      maxPrice: 0,
      minPriceSupermarket: '',
      maxPriceSupermarket: '',
      averagePrice: 0,
      totalQuantity: 0,
      totalSpent: 0,
      purchaseCount: 0,
      trend: 'stable',
    };
  }

  const prices = itemReport.bySupermarket.map((item) => item.averagePrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const minSupermarket = itemReport.bySupermarket.find((item) => item.averagePrice === minPrice)?.supermarket || '';
  const maxSupermarket = itemReport.bySupermarket.find((item) => item.averagePrice === maxPrice)?.supermarket || '';

  // For trend, we would need historical data, but for now we'll set as stable
  // In the future, we could compare with previous period
  const trend = 'stable';

  return {
    minPrice,
    maxPrice,
    minPriceSupermarket: minSupermarket,
    maxPriceSupermarket: maxSupermarket,
    averagePrice: itemReport.averagePrice || 0,
    totalQuantity: itemReport.totalQuantity || 0,
    totalSpent: itemReport.totalSpent || 0,
    purchaseCount: itemReport.purchaseCount || 0,
    trend,
  };
};

/**
 * Format price stats for display
 */
export const formatPriceStats = (stats: PriceStats) => ({
  minPrice: formatMoney(stats.minPrice),
  maxPrice: formatMoney(stats.maxPrice),
  minPriceSupermarket: stats.minPriceSupermarket,
  maxPriceSupermarket: stats.maxPriceSupermarket,
  averagePrice: formatMoney(stats.averagePrice),
  totalQuantity: stats.totalQuantity,
  totalSpent: formatMoney(stats.totalSpent),
  purchaseCount: stats.purchaseCount,
  trend: stats.trend,
});
