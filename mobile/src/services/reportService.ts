import { getSupabaseClient } from '../lib/supabaseClient';
import { DashboardStats } from '../types';
import { getCurrentUserId } from './authService';
import { SupabaseClient } from '@supabase/supabase-js';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

const buildDateRange = (month?: number, year?: number): { startDate: string; endDate: string } => {
  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

const parseDateParts = (rawDate: string): { year: number; month: number; day: number } | null => {
  if (!rawDate) {
    return null;
  }

  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
};

export const reportService = {
  async getDashboardStats(month?: number, year?: number): Promise<DashboardStats> {
    const userId = await getCurrentUserId();
    const supabase = getClient();
    const { startDate, endDate } = buildDateRange(month, year);

    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('id, total_price')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (purchasesError) {
      throw new Error(purchasesError.message);
    }

    const purchaseCount = purchases?.length || 0;
    const totalSpent = purchases?.reduce((sum, p) => {
      const value = parseFloat(p.total_price);
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0) || 0;

    const purchaseIds = purchases?.map(p => p.id) || [];
    let itemCount = 0;

    if (purchaseIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('quantity')
        .in('purchase_id', purchaseIds);

      if (!itemsError && items) {
        itemCount = items.reduce((sum, item) => {
          const value = parseFloat(item.quantity);
          return sum + (Number.isNaN(value) ? 0 : value);
        }, 0);
      }
    }

    return {
      totalSpent,
      purchaseCount,
      itemCount,
      savings: 0,
    };
  },

  async getUserSavings(
    month?: number,
    year?: number
  ): Promise<number> {
    const userId = await getCurrentUserId();
    const supabase = getClient();
    const { startDate, endDate } = buildDateRange(month, year);

    try {
      // Primeiro, buscar IDs das compras do período atual
      const { data: currentPurchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (purchasesError || !currentPurchases || currentPurchases.length === 0) {
        return 0;
      }

      const currentPurchaseIds = currentPurchases.map(p => p.id);

      // Buscar items das compras atuais
      const { data: currentItems, error: currentError } = await supabase
        .from('items')
        .select('name, price, quantity, purchase_id')
        .in('purchase_id', currentPurchaseIds);

      if (currentError || !currentItems || currentItems.length === 0) {
        return 0;
      }

      // Buscar IDs das compras históricas (últimos 12 meses antes do período atual)
      const oneYearAgo = new Date(startDate);
      oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
      const minDate = oneYearAgo.toISOString().split('T')[0];
      
      const { data: historicalPurchases, error: histPurchasesError } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', userId)
        .lt('date', startDate)
        .gte('date', minDate);

      if (histPurchasesError || !historicalPurchases || historicalPurchases.length === 0) {
        return 0;
      }

      const historicalPurchaseIds = historicalPurchases.map(p => p.id);

      // Buscar nomes únicos dos items atuais
      const itemNames = [...new Set(currentItems.map(item => item.name))];

      // Buscar items históricos com mesmo nome (limitado a 1000 para performance)
      const { data: historicalItems, error: historicalError } = await supabase
        .from('items')
        .select('name, price')
        .in('name', itemNames)
        .in('purchase_id', historicalPurchaseIds)
        .limit(1000);

      if (historicalError || !historicalItems || historicalItems.length === 0) {
        return 0;
      }

      // Calcular média por item
      const avgPrices: Record<string, { sum: number; count: number }> = {};
      historicalItems.forEach(item => {
        if (!avgPrices[item.name]) {
          avgPrices[item.name] = { sum: 0, count: 0 };
        }
        const priceValue = parseFloat(item.price);
        if (!Number.isNaN(priceValue)) {
          avgPrices[item.name].sum += priceValue;
          avgPrices[item.name].count += 1;
        }
      });

      // Calcular economia total
      let totalSavings = 0;
      
      currentItems.forEach(currentItem => {
        const itemAvg = avgPrices[currentItem.name];
        if (itemAvg && itemAvg.count >= 3) {  // Pelo menos 3 compras anteriores para média confiável
          const avgPrice = itemAvg.sum / itemAvg.count;
          const currentPrice = parseFloat(currentItem.price);
          const quantity = parseFloat(currentItem.quantity);
          
          if (!Number.isNaN(currentPrice) && !Number.isNaN(quantity)) {
            const savingsPerItem = (avgPrice - currentPrice) * quantity;
            if (savingsPerItem > 0) {
              totalSavings += savingsPerItem;
            }
          }
        }
      });

      return totalSavings;
    } catch (error) {
      if (__DEV__) {
        console.error('[ReportService] Error calculating savings:', error);
      }
      return 0;
    }
  },

  async getMonthlyExpenses(
    yearOrStartDate: number | string,
    endDate?: string
  ): Promise<Array<{ month: number; total: number }>> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const isYearQuery = typeof yearOrStartDate === 'number';
    const startDate = isYearQuery ? `${yearOrStartDate}-01-01` : yearOrStartDate;
    const resolvedEndDate = isYearQuery ? `${yearOrStartDate}-12-31` : endDate;

    if (!resolvedEndDate) {
      throw new Error('Data final obrigatoria para consulta por periodo');
    }

    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('date, total_price')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', resolvedEndDate);

    if (error) {
      throw new Error(error.message);
    }

    const monthlyTotals: Record<number, number> = {};

    if (isYearQuery) {
      for (let m = 1; m <= 12; m++) {
        monthlyTotals[m] = 0;
      }
    } else {
      const startParts = parseDateParts(startDate);
      const endParts = parseDateParts(resolvedEndDate);

      if (startParts && endParts) {
        const startMonthIndex = startParts.year * 12 + (startParts.month - 1);
        const endMonthIndex = endParts.year * 12 + (endParts.month - 1);

        for (let monthIndex = startMonthIndex; monthIndex <= endMonthIndex; monthIndex++) {
          monthlyTotals[monthIndex] = 0; // use full monthIndex as key to avoid year collisions
        }
      }
    }

    (purchases || []).forEach(p => {
      const dateParts = parseDateParts(String(p.date));
      if (!dateParts) {
        return;
      }

      const key = isYearQuery
        ? dateParts.month
        : dateParts.year * 12 + (dateParts.month - 1);
      if (!(key in monthlyTotals)) {
        monthlyTotals[key] = 0;
      }
      monthlyTotals[key] += parseFloat(p.total_price) || 0;
    });

    return Object.entries(monthlyTotals).map(([key, total]) => ({
      month: isYearQuery ? parseInt(key) : (parseInt(key) % 12) + 1,
      total,
    }));
  },

  async getExpensesBySupermarket(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ supermarket: string; total: number }>> {
    const supabase = getClient();

    const { data, error } = await supabase.rpc('report_expenses_by_supermarket', {
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return (Array.isArray(data) ? (data as Array<{ supermarket: string; total: number | string }>) : []).map(row => {
      const totalValue = Number(row.total);
      return {
        supermarket: row.supermarket,
        total: Number.isNaN(totalValue) ? 0 : totalValue,
      };
    });
  },

  async getMarketRanking(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ supermarket: string; total: number; purchaseCount: number; averagePrice: number }>> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    let query = supabase
      .from('purchases')
      .select('id, total_price, supermarket:supermarkets(name)')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const grouped = new Map<string, { total: number; purchaseCount: number }>();
    const purchases = (data ?? []) as Array<{
      total_price: number | string;
      supermarket: { name?: string } | Array<{ name?: string }> | null;
    }>;

    purchases.forEach((purchase) => {
      const market = purchase.supermarket;
      const name = (Array.isArray(market) ? market[0]?.name : market?.name) || 'Sem supermercado';
      const totalPriceValue = Number(purchase.total_price);
      const totalPrice = Number.isNaN(totalPriceValue) ? 0 : totalPriceValue;
      const current = grouped.get(name) ?? { total: 0, purchaseCount: 0 };

      grouped.set(name, {
        total: current.total + totalPrice,
        purchaseCount: current.purchaseCount + 1,
      });
    });

    return Array.from(grouped.entries()).map(([supermarket, totals]) => ({
      supermarket,
      total: totals.total,
      purchaseCount: totals.purchaseCount,
      averagePrice: totals.purchaseCount > 0 ? totals.total / totals.purchaseCount : 0,
    }));
  },

  async getTopItems(
    limit = 10,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ name: string; quantity: number; total: number }>> {
    const supabase = getClient();

    const { data, error } = await supabase.rpc('report_top_items', {
      p_limit: limit,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return (Array.isArray(data) ? (data as Array<{ name: string; quantity: number | string; total: number | string }>) : []).map(row => ({
      name: row.name,
      quantity: Number(row.quantity) || 0,
      total: Number(row.total) || 0,
    }));
  },

  async getItemReport(
    itemName: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalQuantity: number;
    totalSpent: number;
    averagePrice: number;
    purchaseCount: number;
    bySupermarket: Array<{
      supermarket: string;
      totalQuantity: number;
      totalSpent: number;
      averagePrice: number;
    }>;
  }> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    if (!itemName) {
      return {
        totalQuantity: 0,
        totalSpent: 0,
        averagePrice: 0,
        purchaseCount: 0,
        bySupermarket: [],
      };
    }

    // Query otimizada com JOIN único (elimina N+1)
    let query = supabase
      .from('items')
      .select(`
        quantity,
        price,
        purchase_id,
        purchases!inner(
          id,
          supermarket:supermarkets(name),
          date,
          user_id
        )
      `)
      .eq('name', itemName)
      .eq('purchases.user_id', userId);

    if (startDate) {
      query = query.gte('purchases.date', startDate);
    }
    if (endDate) {
      query = query.lte('purchases.date', endDate);
    }

    const { data: items, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!items || items.length === 0) {
      return {
        totalQuantity: 0,
        totalSpent: 0,
        averagePrice: 0,
        purchaseCount: 0,
        bySupermarket: [],
      };
    }

    let totalQuantity = 0;
    let totalSpent = 0;
    const purchaseIdSet = new Set<number>();
    const bySupermarketTotals: Record<string, { totalQuantity: number; totalSpent: number }> = {};

    (items || []).forEach((item: unknown) => {
      const typedItem = item as {
        quantity: string | number;
        price: string | number;
        purchase_id: number;
        purchases: {
          supermarket: { name?: string } | Array<{ name?: string }> | null;
        };
      };
      
      const quantity = parseFloat(String(typedItem.quantity)) || 0;
      const price = parseFloat(String(typedItem.price)) || 0;
      const itemTotal = quantity * price;
      
      const supermarket = typedItem.purchases?.supermarket;
      const supermarketName = (Array.isArray(supermarket) ? supermarket[0]?.name : supermarket?.name) || 'Sem supermercado';

      totalQuantity += quantity;
      totalSpent += itemTotal;
      purchaseIdSet.add(typedItem.purchase_id);

      if (!bySupermarketTotals[supermarketName]) {
        bySupermarketTotals[supermarketName] = { totalQuantity: 0, totalSpent: 0 };
      }
      bySupermarketTotals[supermarketName].totalQuantity += quantity;
      bySupermarketTotals[supermarketName].totalSpent += itemTotal;
    });

    const bySupermarket = Object.entries(bySupermarketTotals).map(([supermarket, data]) => ({
      supermarket,
      totalQuantity: data.totalQuantity,
      totalSpent: data.totalSpent,
      averagePrice: data.totalQuantity > 0 ? data.totalSpent / data.totalQuantity : 0,
    }));

    return {
      totalQuantity,
      totalSpent,
      averagePrice: totalQuantity > 0 ? totalSpent / totalQuantity : 0,
      purchaseCount: purchaseIdSet.size,
      bySupermarket,
    };
  },

  async getItemPriceHistory(
    itemName: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ month: number; year: number; averagePrice: number }>> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    if (!itemName) {
      return [];
    }

    // Query otimizada com JOIN único (elimina N+1)
    let query = supabase
      .from('items')
      .select(`
        quantity,
        price,
        purchases!inner(
          date,
          user_id
        )
      `)
      .eq('name', itemName)
      .eq('purchases.user_id', userId);

    if (startDate) {
      query = query.gte('purchases.date', startDate);
    }

    if (endDate) {
      query = query.lte('purchases.date', endDate);
    }

    const { data: items, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!items || items.length === 0) {
      return [];
    }

    const monthlyMap = new Map<string, { totalSpent: number; totalQuantity: number; month: number; year: number }>();

    (items ?? []).forEach((item: unknown) => {
      const typedItem = item as {
        quantity: string | number;
        price: string | number;
        purchases: { date: string };
      };
      
      const purchaseDate = typedItem.purchases?.date;
      if (!purchaseDate) {
        return;
      }

      const dateParts = parseDateParts(purchaseDate);
      if (!dateParts) {
        return;
      }

      const month = dateParts.month;
      const year = dateParts.year;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const quantity = parseFloat(String(typedItem.quantity)) || 0;
      const price = parseFloat(String(typedItem.price)) || 0;

      const current = monthlyMap.get(key) ?? { totalSpent: 0, totalQuantity: 0, month, year };

      monthlyMap.set(key, {
        ...current,
        totalSpent: current.totalSpent + quantity * price,
        totalQuantity: current.totalQuantity + quantity,
      });
    });

    return Array.from(monthlyMap.values())
      .map((entry) => ({
        month: entry.month,
        year: entry.year,
        averagePrice: entry.totalQuantity > 0 ? entry.totalSpent / entry.totalQuantity : 0,
      }))
      .sort((left, right) => {
        if (left.year === right.year) {
          return left.month - right.month;
        }
        return left.year - right.year;
      });
  },
};
