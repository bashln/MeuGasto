import { supabase } from '../lib/supabaseClient';
import { Purchase, PurchaseFilter, NfceRequest } from '../types';
import { getCurrentUserId } from './authService';
import { nfceService } from './nfceService';

export const purchaseService = {
  async getPurchases(filter?: PurchaseFilter): Promise<Purchase[]> {
    const userId = await getCurrentUserId();
    
    let query = supabase
      .from('purchases')
      .select(`
        *,
        supermarket:supermarkets(*),
        items(*)
      `)
      .eq('user_id', userId);

    if (filter?.supermarketId) {
      query = query.eq('supermarket_id', filter.supermarketId);
    }
    if (filter?.startDate) {
      query = query.gte('date', filter.startDate);
    }
    if (filter?.endDate) {
      query = query.lte('date', filter.endDate);
    }
    if (filter?.minPrice) {
      query = query.gte('total_price', filter.minPrice);
    }
    if (filter?.maxPrice) {
      query = query.lte('total_price', filter.maxPrice);
    }

    const { data: purchases, error } = await query.order('date', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (purchases || []).map((purchase) => {
      const safeItems = Array.isArray(purchase.items) ? purchase.items : [];
      return {
        id: purchase.id,
        supermarket: purchase.supermarket,
        accessKey: purchase.access_key,
        date: purchase.date,
        totalPrice: parseFloat(purchase.total_price) || 0,
        isManual: purchase.manual,
        products: safeItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit,
          price: parseFloat(item.price) || 0,
        })),
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at,
      };
    });
  },

  async getPurchaseById(id: number): Promise<Purchase> {
    const userId = await getCurrentUserId();

    const { data: purchase, error } = await supabase
      .from('purchases')
      .select(`
        *,
        supermarket:supermarkets(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .eq('purchase_id', purchase.id);

    const safeItems = Array.isArray(items) ? items : [];

    return {
      id: purchase.id,
      supermarket: purchase.supermarket,
      accessKey: purchase.access_key,
      date: purchase.date,
      totalPrice: parseFloat(purchase.total_price) || 0,
      isManual: purchase.manual,
      products: (items || []).map(item => ({
        id: item.id,
        name: item.name,
        code: item.code,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit,
        price: parseFloat(item.price) || 0,
      })),
      createdAt: purchase.created_at,
      updatedAt: purchase.updated_at,
    };
  },

  async createPurchaseFromQRCode(data: NfceRequest): Promise<Purchase> {
    const result = await nfceService.createPurchaseFromNFCe(data.qrCodeData);
    return this.getPurchaseById(result.purchaseId);
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
    const userId = await getCurrentUserId();

    // Passo 1: Criar purchase
    const { data: newPurchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        supermarket_id: purchase.supermarketId || null,
        date: purchase.date,
        total_price: purchase.totalPrice,
        manual: true,
      })
      .select()
      .single();

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    // Passo 2: Criar items com purchase_id
    if (purchase.items?.length > 0) {
      const itemsToInsert = purchase.items.map(item => ({
        purchase_id: newPurchase.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(itemsError.message);
      }
    }

    return this.getPurchaseById(newPurchase.id);
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

    const updateData: any = {};
    if (updates.date) updateData.date = updates.date;
    if (updates.totalPrice) updateData.total_price = updates.totalPrice;
    if (updates.supermarketId !== undefined) updateData.supermarket_id = updates.supermarketId;
    updateData.updated_at = new Date().toISOString();

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

    const { error } = await supabase
      .from('purchases')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  },
};
