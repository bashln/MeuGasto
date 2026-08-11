import { getSupabaseClient } from '../lib/supabaseClient';
import { ShoppingList, ShoppingListItem } from '../types';
import { getCurrentUserId } from './authService';
import { SupabaseClient } from '@supabase/supabase-js';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

export const shoppingListService = {
  async getShoppingLists(status?: 'active' | 'completed' | 'archived'): Promise<ShoppingList[]> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    let query = supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(item => ({
      id: item.id,
      userId: item.user_id,
      name: item.name,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  },

  async getShoppingListById(id: number): Promise<ShoppingList> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data: list, error: listError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (listError) {
      throw new Error(listError.message);
    }

    const { data: items, error: itemsError } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    return {
      id: list.id,
      userId: list.user_id,
      name: list.name,
      status: list.status,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
      items: (items || []).map(item => ({
        id: item.id,
        shoppingListId: item.shopping_list_id,
        name: item.name,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit,
        estimatedPrice: parseFloat(item.estimated_price) || 0,
        createdAt: item.created_at,
      })),
    };
  },

  async createShoppingList(name: string): Promise<ShoppingList> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    // Check if active list already exists (defense in depth)
    const { data: existing } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        id: existing.id,
        userId: existing.user_id,
        name: existing.name,
        status: existing.status,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
        items: [],
      };
    }

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({
        user_id: userId,
        name,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      items: [],
    };
  },

  async updateShoppingListStatus(id: number, status: 'active' | 'completed' | 'archived'): Promise<void> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { error } = await supabase
      .from('shopping_lists')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async deleteShoppingList(id: number): Promise<void> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { error } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async addShoppingListItem(listId: number, name: string, quantity: number, unit: string): Promise<ShoppingListItem> {
    const supabase = getClient();

    // Get average price first
    const estimatedPrice = await this.getItemAveragePrice(name);

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        shopping_list_id: listId,
        name,
        quantity,
        unit,
        estimated_price: estimatedPrice,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      shoppingListId: data.shopping_list_id,
      name: data.name,
      quantity: parseFloat(data.quantity) || 1,
      unit: data.unit,
      estimatedPrice: parseFloat(data.estimated_price) || 0,
      createdAt: data.created_at,
    };
  },

  async updateShoppingListItem(itemId: number, quantity: number, unit: string): Promise<void> {
    const supabase = getClient();

    const { error } = await supabase
      .from('shopping_list_items')
      .update({ quantity, unit })
      .eq('id', itemId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async deleteShoppingListItem(itemId: number): Promise<void> {
    const supabase = getClient();

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async getItemAveragePrice(name: string): Promise<number> {
    const supabase = getClient();
    
    const { data, error } = await supabase.rpc('get_item_average_price', {
      p_item_name: name,
    });

    if (error) {
      console.warn('[shoppingListService] Erro ao buscar preco medio:', error.message);
      return 0;
    }

    return parseFloat(data) || 0;
  },

  async getItemAveragePricesBulk(names: string[]): Promise<Record<string, number>> {
    if (names.length === 0) return {};
    const supabase = getClient();

    const { data, error } = await supabase.rpc('get_items_average_prices_bulk', {
      p_item_names: names,
    });

    if (error) {
      console.warn('[shoppingListService] Erro ao buscar precos medios bulk:', error.message);
      return {};
    }

    const result: Record<string, number> = {};
    if (Array.isArray(data)) {
      for (const row of data) {
        result[row.item_name] = parseFloat(row.avg_price) || 0;
      }
    }
    return result;
  },
};
