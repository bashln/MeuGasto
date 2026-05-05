import { getSupabaseClient } from '../lib/supabaseClient';
import { Purchase, PurchaseFilter, PageResponse } from '../types';
import { getCurrentUserId } from './authService';
import { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_PRODUCT_CATEGORY_RULES, CATEGORY_IDS } from './productCategoryRules';
import { ProductCategorizerService } from './productCategorizerService';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

type PurchaseItemRow = {
  id: number;
  purchase_id?: number;
  name: string;
  code?: string;
  category_id?: number;
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

type EditItemPayload = {
  name: string;
  quantity: number;
  price: number;
};

const mapPurchaseItems = (items: unknown): Purchase['products'] => {
  const safeItems = Array.isArray(items) ? items : [];

  return safeItems.map((item: PurchaseItemRow) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    categoryId: item.category_id,
    quantity: Number(item.quantity) || 1,
    unit: item.unit,
    price: Number(item.price) || 0,
  }));
};

const productCategorizer = new ProductCategorizerService({
  rules: DEFAULT_PRODUCT_CATEGORY_RULES,
  fallbackCategoryId: CATEGORY_IDS.OUTROS,
});

export const purchaseService = {
  async getPurchases(filter?: PurchaseFilter): Promise<{ data: Purchase[]; page: PageResponse<Purchase>['page'] }> {
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
        last: totalPages === 0 ? true : page >= totalPages - 1,
      },
    };
  },

  async getPurchaseById(id: number): Promise<Purchase> {
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
        category_id: productCategorizer.categorizeProduct(item.name),
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      }));

    const supabase = getClient();

    const { data: createdPurchase, error: purchaseError } = await supabase.rpc('create_purchase_with_items', {
      p_supermarket_id: purchase.supermarketId || null,
      p_access_key: null,
      p_date: purchase.date,
      p_total_price: purchase.totalPrice,
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
    const userId = await getCurrentUserId();

    const updateData: PurchaseUpdateData = { updated_at: new Date().toISOString() };
    if (updates.date) updateData.date = updates.date;
    if (updates.totalPrice !== undefined) updateData.total_price = updates.totalPrice;
    if (updates.supermarketId !== undefined) updateData.supermarket_id = updates.supermarketId;

    const supabase = getClient();

    const { error } = await supabase
      .from('purchases')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return this.getPurchaseById(id);
  },

  async deletePurchase(id: number): Promise<void> {
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
  },

  async reclassifyPurchaseItem(itemId: number, productName: string, categoryId: number): Promise<void> {
    const supabase = getClient();

    const { error } = await supabase
      .from('items')
      .update({ category_id: categoryId })
      .eq('id', itemId);

    if (error) {
      throw new Error(error.message);
    }

    productCategorizer.learnReclassification(productName, categoryId);
  },

  async editItem(purchaseId: number, itemId: number, updates: EditItemPayload): Promise<Purchase> {
    const userId = await getCurrentUserId();
    const name = updates.name.trim();
    const quantity = Number(updates.quantity);
    const price = Number(updates.price);

    if (!name) {
      throw new Error('Nome do item é obrigatório');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('Preço unitário inválido');
    }

    const supabase = getClient();

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, manual')
      .eq('id', purchaseId)
      .eq('user_id', userId)
      .single();

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }
    if (!purchase?.manual) {
      throw new Error('Compras NFC-e são somente leitura');
    }

    const { error: itemError } = await supabase
      .from('items')
      .update({
        name,
        quantity,
        price,
      })
      .eq('id', itemId)
      .eq('purchase_id', purchaseId);

    if (itemError) {
      throw new Error(itemError.message);
    }

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('quantity, price')
      .eq('purchase_id', purchaseId);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const recalculatedTotal = (items ?? []).reduce((acc: number, item: { quantity: number | string; price: number | string }) => {
      return acc + (Number(item.quantity) || 0) * (Number(item.price) || 0);
    }, 0);

    const { error: purchaseUpdateError } = await supabase
      .from('purchases')
      .update({
        total_price: Number(recalculatedTotal.toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseId)
      .eq('user_id', userId);

    if (purchaseUpdateError) {
      throw new Error(purchaseUpdateError.message);
    }

    return this.getPurchaseById(purchaseId);
  },
};
