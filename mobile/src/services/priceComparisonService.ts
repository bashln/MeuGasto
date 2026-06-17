import { getSupabaseClient } from '../lib/supabaseClient';
import { PriceComparisonSession, PriceComparisonQuote, PriceComparisonQuoteItem } from '../types';
import { getCurrentUserId } from './authService';
import { SupabaseClient } from '@supabase/supabase-js';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

type DbRow = Record<string, unknown>;

const mapSession = (row: DbRow): PriceComparisonSession => ({
  id: row.id as number,
  userId: row.user_id as string,
  title: row.title as string,
  sourceShoppingListId: row.source_shopping_list_id as number | undefined,
  expiresAt: row.expires_at as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

const mapQuote = (row: DbRow): PriceComparisonQuote => ({
  id: row.id as number,
  sessionId: row.session_id as number,
  supermarketId: row.supermarket_id as number | undefined,
  marketNameSnapshot: row.market_name_snapshot as string,
  notes: row.notes as string | undefined,
  totalPrice: parseFloat(row.total_price as string) || 0,
  createdAt: row.created_at as string,
});

const mapQuoteItem = (row: DbRow): PriceComparisonQuoteItem => ({
  id: row.id as number,
  quoteId: row.quote_id as number,
  name: row.name as string,
  normalizedName: row.normalized_name as string | undefined,
  quantity: parseFloat(row.quantity as string) || 1,
  unit: row.unit as string,
  price: parseFloat(row.price as string) || 0,
  createdAt: row.created_at as string,
});

export const priceComparisonService = {
  async getActiveSessions(): Promise<PriceComparisonSession[]> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data, error } = await supabase
      .from('price_comparison_sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(mapSession);
  },

  async getSessionById(id: number): Promise<PriceComparisonSession> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data: session, error: sessionError } = await supabase
      .from('price_comparison_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const { data: quotes, error: quotesError } = await supabase
      .from('price_comparison_quotes')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (quotesError) {
      throw new Error(quotesError.message);
    }

    const mappedQuotes = await Promise.all(
      (quotes || []).map(async (q) => {
        const { data: items, error: itemsError } = await supabase
          .from('price_comparison_quote_items')
          .select('*')
          .eq('quote_id', q.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          throw new Error(itemsError.message);
        }

        return {
          ...mapQuote(q),
          items: (items || []).map(mapQuoteItem),
        };
      })
    );

    return {
      ...mapSession(session),
      quotes: mappedQuotes,
    };
  },

  async createSession(title: string, sourceShoppingListId?: number): Promise<PriceComparisonSession> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data, error } = await supabase
      .from('price_comparison_sessions')
      .insert({
        user_id: userId,
        title,
        source_shopping_list_id: sourceShoppingListId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapSession(data);
  },

  async deleteSession(id: number): Promise<void> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { error } = await supabase
      .from('price_comparison_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async addQuote(
    sessionId: number,
    marketName: string,
    supermarketId?: number,
    notes?: string,
  ): Promise<PriceComparisonQuote> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('price_comparison_quotes')
      .insert({
        session_id: sessionId,
        supermarket_id: supermarketId || null,
        market_name_snapshot: marketName,
        notes: notes || null,
        total_price: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapQuote(data);
  },

  async updateQuoteTotal(quoteId: number): Promise<void> {
    const supabase = getClient();

    const { data: items, error: itemsError } = await supabase
      .from('price_comparison_quote_items')
      .select('price, quantity')
      .eq('quote_id', quoteId);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    const dbItems = (items || []) as DbRow[];
    const total = dbItems.reduce(
      (sum: number, item) => sum + (parseFloat(item.price as string) || 0) * (parseFloat(item.quantity as string) || 1),
      0,
    );

    const { error: updateError } = await supabase
      .from('price_comparison_quotes')
      .update({ total_price: total })
      .eq('id', quoteId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  },

  async addQuoteItem(
    quoteId: number,
    name: string,
    quantity: number,
    unit: string,
    price: number,
  ): Promise<PriceComparisonQuoteItem> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('price_comparison_quote_items')
      .insert({
        quote_id: quoteId,
        name,
        quantity,
        unit,
        price,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapQuoteItem(data);
  },

  async deleteQuote(quoteId: number): Promise<void> {
    const supabase = getClient();

    const { error } = await supabase
      .from('price_comparison_quotes')
      .delete()
      .eq('id', quoteId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async copyItemsToQuote(
    quoteId: number,
    items: Array<{ name: string; quantity: number; unit: string; price: number }>,
  ): Promise<void> {
    for (const item of items) {
      await this.addQuoteItem(quoteId, item.name, item.quantity, item.unit, item.price);
    }
    await this.updateQuoteTotal(quoteId);
  },

  async getComparisonSummary(sessionId: number): Promise<{
    quotes: Array<{
      id: number;
      marketName: string;
      totalPrice: number;
      itemCount: number;
      items: Array<{
        name: string;
        quantity: number;
        unit: string;
        price: number;
        unitPrice: number;
      }>;
    }>;
    cheapestPerItem: Record<string, { marketName: string; price: number }>;
  }> {
    const session = await this.getSessionById(sessionId);
    const quotes: Array<{
      id: number; marketName: string; totalPrice: number; itemCount: number;
      items: Array<{ name: string; quantity: number; unit: string; price: number; unitPrice: number }>;
    }> = [];
    const cheapestPerItem: Record<string, { marketName: string; price: number }> = {};

    if (!session.quotes) {
      return { quotes: [], cheapestPerItem: {} };
    }

    for (const quote of session.quotes) {
      const items = (quote.items || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        unitPrice: item.quantity > 0 ? item.price / item.quantity : item.price,
      }));

      quotes.push({
        id: quote.id,
        marketName: quote.marketNameSnapshot,
        totalPrice: quote.totalPrice,
        itemCount: items.length,
        items,
      });

      for (const item of items) {
        const key = item.name.toLowerCase();
        if (
          !cheapestPerItem[key] ||
          item.unitPrice < cheapestPerItem[key].price
        ) {
          cheapestPerItem[key] = {
            marketName: quote.marketNameSnapshot,
            price: item.unitPrice,
          };
        }
      }
    }

    return { quotes, cheapestPerItem };
  },
};
