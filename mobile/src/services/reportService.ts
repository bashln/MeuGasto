import { supabase } from '../lib/supabaseClient';
import { DashboardStats } from '../types';
import { authService } from './authService';

const getCurrentUserId = async (): Promise<string> => {
  const { user } = await authService.getSession();
  if (!user?.id) {
    throw new Error('User not authenticated');
  }
  return user.id;
};

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

    let query = supabase
      .from('purchases')
      .select(`
        total_price,
        supermarket:supermarkets(name)
      `)
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: purchases, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Agrupar por supermercado
    const supermarketTotals: Record<string, number> = {};
    (purchases || []).forEach((p: any) => {
      const supermarket = p.supermarket;
      const name = (Array.isArray(supermarket) ? supermarket[0]?.name : supermarket?.name) || 'Sem supermercado';
      supermarketTotals[name] = (supermarketTotals[name] || 0) + (parseFloat(p.total_price) || 0);
    });

    return Object.entries(supermarketTotals).map(([supermarket, total]) => ({
      supermarket,
      total,
    }));
  },

  async getTopItems(
    limit = 10,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ name: string; quantity: number; total: number }>> {
    const userId = await getCurrentUserId();

    // Buscar compras do período
    let purchasesQuery = supabase
      .from('purchases')
      .select('id')
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
      return [];
    }

    // Buscar itens
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('name, quantity, price')
      .in('purchase_id', purchaseIds);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    // Agrupar por nome
    const itemTotals: Record<string, { quantity: number; total: number }> = {};
    (items || []).forEach(item => {
      const name = item.name || 'Sem nome';
      if (!itemTotals[name]) {
        itemTotals[name] = { quantity: 0, total: 0 };
      }
      itemTotals[name].quantity += parseFloat(item.quantity) || 0;
      itemTotals[name].total += (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
    });

    return Object.entries(itemTotals)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  },
};
