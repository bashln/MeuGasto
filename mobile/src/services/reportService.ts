import { supabase } from '../lib/supabaseClient';
import { DashboardStats } from '../types';
import { getCurrentUserId } from './authService';

export const reportService = {
  async getDashboardStats(month?: number, year?: number): Promise<DashboardStats> {
    const userId = await getCurrentUserId();

    // Construir range de datas para o mês/ano especificado
    let startDate: string;
    let endDate: string;

    if (month && year) {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // Mês atual por padrão
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Buscar compras do período
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
    const totalSpent = purchases?.reduce((sum, p) => sum + (parseFloat(p.total_price) || 0), 0) || 0;

    // Buscar todos os itens das compras do período
    const purchaseIds = purchases?.map(p => p.id) || [];
    let itemCount = 0;

    if (purchaseIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('quantity')
        .in('purchase_id', purchaseIds);

      if (!itemsError && items) {
        itemCount = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      }
    }

    return {
      totalSpent,
      purchaseCount,
      itemCount,
      savings: 0, // Por enquanto não calculado
    };
  },

  async getMonthlyExpenses(year: number): Promise<Array<{ month: number; total: number }>> {
    const userId = await getCurrentUserId();

    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('date, total_price')
      .eq('user_id', userId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);

    if (error) {
      throw new Error(error.message);
    }

    // Agrupar por mês
    const monthlyTotals: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      monthlyTotals[m] = 0;
    }

    (purchases || []).forEach(p => {
      const month = new Date(p.date).getMonth() + 1;
      monthlyTotals[month] += parseFloat(p.total_price) || 0;
    });

    return Object.entries(monthlyTotals).map(([month, total]) => ({
      month: parseInt(month),
      total,
    }));
  },

  async getExpensesBySupermarket(
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ supermarket: string; total: number }>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('report_expenses_by_supermarket', {
      p_user_id: userId,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return ((data as Array<{ supermarket: string; total: number | string }> | null) ?? []).map(row => ({
      supermarket: row.supermarket,
      total: Number(row.total) || 0,
    }));
  },

  async getTopItems(
    limit = 10,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ name: string; quantity: number; total: number }>> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase.rpc('report_top_items', {
      p_user_id: userId,
      p_limit: limit,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return ((data as Array<{ name: string; quantity: number | string; total: number | string }> | null) ?? []).map(row => ({
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

    if (!itemName) {
      return {
        totalQuantity: 0,
        totalSpent: 0,
        averagePrice: 0,
        purchaseCount: 0,
        bySupermarket: [],
      };
    }

    let purchasesQuery = supabase
      .from('purchases')
      .select('id, supermarket:supermarkets(name), date')
      .eq('user_id', userId);

    if (startDate) {
      purchasesQuery = purchasesQuery.gte('date', startDate);
    }
    if (endDate) {
      purchasesQuery = purchasesQuery.lte('date', endDate);
    }

    const { data: purchases, error: purchasesError } = await purchasesQuery;

    if (purchasesError) {
      throw new Error(purchasesError.message);
    }

    const purchaseIds = purchases?.map(p => p.id) || [];
    if (purchaseIds.length === 0) {
      return {
        totalQuantity: 0,
        totalSpent: 0,
        averagePrice: 0,
        purchaseCount: 0,
        bySupermarket: [],
      };
    }

    const supermarketByPurchaseId: Record<number, string> = {};
    const purchasesWithMarket = (purchases ?? []) as Array<{
      id: number;
      supermarket: { name?: string } | Array<{ name?: string }> | null;
    }>;
    purchasesWithMarket.forEach((p) => {
      const supermarket = p.supermarket;
      const name = (Array.isArray(supermarket) ? supermarket[0]?.name : supermarket?.name) || 'Sem supermercado';
      supermarketByPurchaseId[p.id] = name;
    });

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('purchase_id, name, quantity, price')
      .in('purchase_id', purchaseIds)
      .eq('name', itemName);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    let totalQuantity = 0;
    let totalSpent = 0;
    const purchaseIdSet = new Set<number>();
    const bySupermarketTotals: Record<string, { totalQuantity: number; totalSpent: number }> = {};

    (items || []).forEach(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      const itemTotal = quantity * price;
      const purchaseId = item.purchase_id as number;
      const supermarketName = supermarketByPurchaseId[purchaseId] || 'Sem supermercado';

      totalQuantity += quantity;
      totalSpent += itemTotal;
      purchaseIdSet.add(purchaseId);

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
};
