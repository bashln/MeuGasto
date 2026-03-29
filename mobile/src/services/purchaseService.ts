import { getSupabaseClient } from '../lib/supabaseClient';
import { Purchase, PurchaseFilter, PageResponse } from '../types';
import { getCurrentUserId } from './authService';
import { withRetry } from '../utils/retryUtils';
import { SupabaseClient } from '@supabase/supabase-js';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

type PurchaseItemRow = {
  id: number;
  name: string;
  code?: string;
  quantity: number | string;
  unit: string;
  price: number | string;
};

type PurchaseUpdateData = {
  date?: string;
  total_price?: number;
  supermarket_id?: number | null;
  updated_at: string;
};

const mapPurchaseItems = (items: unknown): Purchase['products'] => {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map((item: PurchaseItemRow) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    quantity: Number(item.quantity) || 1,
    unit: item.unit,
    price: Number(item.price) || 0,
  }));
};

const calculateItemsTotal = (
  items: Array<{ quantity: number; price: number }>,
): number => Number(items.reduce((sum, item) => sum + item.quantity * item.price, 0).toFixed(2));

export const purchaseService = {
  async getPurchases(filter?: PurchaseFilter): Promise<{ data: Purchase[]; page: PageResponse<Purchase>['page'] }> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();
      const page = filter?.page ?? 0;
      const size = filter?.size ?? 20;
      const from = page * size;
      const to = from + size - 1;
      
      const supabase = getClient();
      
      let query = supabase
        .from('purchases')
        .select(`
          *,
          supermarket:supermarkets(*),
          items(*)
        `, { count: 'exact' })
        .eq('user_id', userId);

      if (filter?.supermarketId) {
        query = query.eq('supermarket_id', filter.supermarketId);
      }
      if (filter?.isManual !== undefined) {
        query = query.eq('manual', filter.isManual);
      }
      if (filter?.startDate) {
        query = query.gte('date', filter.startDate);
      }
      if (filter?.endDate) {
        query = query.lte('date', filter.endDate);
      }
      if (filter?.minPrice !== undefined) {
        query = query.gte('total_price', filter.minPrice);
      }
      if (filter?.maxPrice !== undefined) {
        query = query.lte('total_price', filter.maxPrice);
      }

      const { data: purchases, error, count } = await query
        .order('date', { ascending: false })
        .range(from, to);

      if (error) {
        throw new Error(error.message);
      }

      const purchaseData = (purchases || []).map((purchase) => {
        return {
          id: purchase.id,
          supermarket: purchase.supermarket,
          accessKey: purchase.access_key,
          date: purchase.date,
          totalPrice: parseFloat(purchase.total_price) || 0,
          isManual: purchase.manual,
          products: mapPurchaseItems(purchase.items),
          createdAt: purchase.created_at,
          updatedAt: purchase.updated_at,
        };
      });

      const totalElements = count || 0;
      const totalPages = Math.ceil(totalElements / size);

      return {
        data: purchaseData,
        page: {
          pageNumber: page,
          pageSize: size,
          totalElements,
          totalPages,
          last: page >= totalPages - 1,
        },
      };
    }, { maxRetries: 3, initialDelay: 500 });
  },

  async getPurchaseById(id: number): Promise<Purchase> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();
      const supabase = getClient();

      const { data: purchase, error } = await supabase
        .from('purchases')
        .select(`
          *,
          supermarket:supermarkets(*),
          items(*)
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (!purchase) {
        throw new Error('Compra não encontrada');
      }

      return {
        id: purchase.id,
        supermarket: purchase.supermarket,
        accessKey: purchase.access_key,
        date: purchase.date,
        totalPrice: parseFloat(purchase.total_price) || 0,
        isManual: purchase.manual,
        products: mapPurchaseItems(purchase.items),
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at,
      };
    }, { maxRetries: 3, initialDelay: 500 });
  },

  async createManualPurchase(purchase: {
    supermarketId?: number;
    date: string;
    totalPrice: number;
    items: Array<{
      name: string;
      quantity: number;
      unit: string;
      price: number;
    }>;
  }): Promise<Purchase> {
    const itemsPayload = (purchase.items ?? []).map(item => ({
        name: item.name,
        code: '',
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      }));
    const resolvedTotalPrice = itemsPayload.length > 0
      ? calculateItemsTotal(itemsPayload)
      : purchase.totalPrice;

    const supabase = getClient();

    const { data: createdPurchase, error: purchaseError } = await supabase.rpc('create_purchase_with_items', {
      p_supermarket_id: purchase.supermarketId || null,
      p_access_key: null,
      p_date: purchase.date,
      p_total_price: resolvedTotalPrice,
      p_manual: true,
      p_items: itemsPayload,
    });

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    const purchaseId = createdPurchase?.[0]?.purchase_id;
    if (!purchaseId) {
      throw new Error('Não foi possível criar a compra manual');
    }

    return this.getPurchaseById(purchaseId);
  },

  async updatePurchase(
    id: number,
    updates: Partial<{
      date: string;
      totalPrice: number;
      supermarketId: number | null;
    }>
  ): Promise<Purchase> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();
      const supabase = getClient();

      const { data: existingPurchase, error: existingPurchaseError } = await supabase
        .from('purchases')
        .select('manual')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (existingPurchaseError) {
        throw new Error(existingPurchaseError.message);
      }

      if (!existingPurchase?.manual) {
        throw new Error('Compras importadas via NFC-e não podem ser alteradas.');
      }

      const updateData: PurchaseUpdateData = { updated_at: new Date().toISOString() };
      if (updates.date) updateData.date = updates.date;
      if (updates.totalPrice !== undefined) updateData.total_price = updates.totalPrice;
      if (updates.supermarketId !== undefined) updateData.supermarket_id = updates.supermarketId;

      const { error } = await supabase
        .from('purchases')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return this.getPurchaseById(id);
    }, { maxRetries: 2, initialDelay: 300 });
  },

  async searchPurchases(
    query: string,
    filter?: PurchaseFilter
  ): Promise<{ data: Purchase[]; page: PageResponse<Purchase>['page'] }> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();
      const page = filter?.page ?? 0;
      const size = filter?.size ?? 20;
      const from = page * size;
      const to = from + size - 1;
      
      const supabase = getClient();
      
      // Busca server-side com texto
      let dbQuery = supabase
        .from('purchases')
        .select(`
          *,
          supermarket:supermarkets(*),
          items(*)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .or(`access_key.ilike.%${query}%,supermarket.name.ilike.%${query}%`);

      if (filter?.isManual !== undefined) {
        dbQuery = dbQuery.eq('manual', filter.isManual);
      }
      if (filter?.startDate) {
        dbQuery = dbQuery.gte('date', filter.startDate);
      }
      if (filter?.endDate) {
        dbQuery = dbQuery.lte('date', filter.endDate);
      }

      const { data: purchases, error, count } = await dbQuery
        .order('date', { ascending: false })
        .range(from, to);

      if (error) {
        throw new Error(error.message);
      }

      const purchaseData = (purchases || []).map((purchase) => {
        return {
          id: purchase.id,
          supermarket: purchase.supermarket,
          accessKey: purchase.access_key,
          date: purchase.date,
          totalPrice: parseFloat(purchase.total_price) || 0,
          isManual: purchase.manual,
          products: mapPurchaseItems(purchase.items),
          createdAt: purchase.created_at,
          updatedAt: purchase.updated_at,
        };
      });

      const totalElements = count || 0;
      const totalPages = Math.ceil(totalElements / size);

      return {
        data: purchaseData,
        page: {
          pageNumber: page,
          pageSize: size,
          totalElements,
          totalPages,
          last: page >= totalPages - 1,
        },
      };
    }, { maxRetries: 3, initialDelay: 500 });
  },

  async getDashboardData(
    month: number,
    year: number
  ): Promise<{
    stats: {
      totalSpent: number;
      purchaseCount: number;
      itemCount: number;
    };
    topItems: Array<{ name: string; quantity: number; total: number }>;
    supermarketData: Array<{ supermarket: string; total: number }>;
    monthlyTotals: Array<{ month: number; total: number }>;
    savings: number;
  }> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const supabase = getClient();

      // Query única consolidada para dashboard
      const { data: dashboardData, error } = await supabase.rpc('get_dashboard_data', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_year: year,
      });

      if (error) {
        // Fallback para queries individuais se RPC não existir
        console.warn('RPC não disponível, usando fallback:', error);
        throw error;
      }

      return dashboardData;
    }, { maxRetries: 3, initialDelay: 500 });
  },

  async updatePurchaseItems(
    purchaseId: number,
    items: Array<{ id?: number; name: string; quantity: number; unit: string; price: number }>
  ): Promise<Purchase> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();
      const supabase = getClient();

      // Verifica se a compra existe e pertence ao usuário
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('id, manual')
        .eq('id', purchaseId)
        .eq('user_id', userId)
        .single();

      if (purchaseError || !purchase) {
        throw new Error('Compra não encontrada');
      }

      if (!purchase.manual) {
        throw new Error('Compras importadas via NFC-e não podem ter itens alterados.');
      }

      // Deleta items existentes
      const { error: deleteError } = await supabase
        .from('items')
        .delete()
        .eq('purchase_id', purchaseId);

      if (deleteError) {
        throw new Error(`Erro ao remover itens antigos: ${deleteError.message}`);
      }

      // Insere novos items
      const itemsToInsert = items.map(item => ({
        purchase_id: purchaseId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      }));

      const { error: insertError } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (insertError) {
        throw new Error(`Erro ao inserir novos itens: ${insertError.message}`);
      }

      // Recalcula o total
      const newTotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      // Atualiza o total da compra
      const { error: updateError } = await supabase
        .from('purchases')
        .update({ 
          total_price: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseId)
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(`Erro ao atualizar total: ${updateError.message}`);
      }

      return this.getPurchaseById(purchaseId);
    }, { maxRetries: 2, initialDelay: 300 });
  },

  async deletePurchase(id: number): Promise<void> {
    return withRetry(async () => {
      const userId = await getCurrentUserId();

      const supabase = getClient();

      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }
    }, { maxRetries: 2, initialDelay: 300 });
  },
};
