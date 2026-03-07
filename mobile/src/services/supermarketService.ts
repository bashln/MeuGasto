import { getSupabaseClient } from '../lib/supabaseClient';
import { Supermarket } from '../types';
import { getCurrentUserId } from './authService';
import { SupabaseClient } from '@supabase/supabase-js';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

type PaginationInfo = {
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
};

export const supermarketService = {
  async getSupermarkets(page = 0, size = 20): Promise<{ data: Supermarket[]; page: PaginationInfo }> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const from = page * size;
    const to = from + size - 1;

    const { data: supermarkets, error, count } = await supabase
      .from('supermarkets')
      .select('*', { count: 'exact' })
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: (supermarkets || []).map(s => ({
        id: s.id,
        name: s.name,
        cnpj: s.cnpj,
        city: s.city,
        state: s.state,
        isManual: s.manual,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      page: {
        pageNumber: page,
        pageSize: size,
        totalElements: count || 0,
        totalPages: Math.ceil((count || 0) / size),
      },
    };
  },

  async getSupermarketById(id: number): Promise<Supermarket> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from('supermarkets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      name: data.name,
      cnpj: data.cnpj,
      city: data.city,
      state: data.state,
      isManual: data.manual,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async createSupermarket(data: {
    name: string;
    cnpj?: string;
    city: string;
    state: string;
  }): Promise<Supermarket> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data: supermarket, error } = await supabase
      .from('supermarkets')
      .insert({
        ...data,
        user_id: userId,
        manual: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: supermarket.id,
      name: supermarket.name,
      cnpj: supermarket.cnpj,
      city: supermarket.city,
      state: supermarket.state,
      isManual: supermarket.manual,
      createdAt: supermarket.created_at,
      updatedAt: supermarket.updated_at,
    };
  },

  async updateSupermarket(
    id: number,
    data: {
      name?: string;
      cnpj?: string;
      city?: string;
      state?: string;
    }
  ): Promise<Supermarket> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data: existing } = await supabase
      .from('supermarkets')
      .select('manual, user_id')
      .eq('id', id)
      .single();

    if (!existing?.manual) {
      throw new Error('Não é possível editar supermercados criados via QR Code');
    }

    if (existing?.user_id !== userId) {
      throw new Error('Acesso negado');
    }

    const { data: supermarket, error } = await supabase
      .from('supermarkets')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: supermarket.id,
      name: supermarket.name,
      cnpj: supermarket.cnpj,
      city: supermarket.city,
      state: supermarket.state,
      isManual: supermarket.manual,
      createdAt: supermarket.created_at,
      updatedAt: supermarket.updated_at,
    };
  },

  async deleteSupermarket(id: number): Promise<void> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data: existing } = await supabase
      .from('supermarkets')
      .select('manual, user_id')
      .eq('id', id)
      .single();

    if (!existing?.manual) {
      throw new Error('Não é possível deletar supermercados criados via QR Code');
    }

    if (existing?.user_id !== userId) {
      throw new Error('Acesso negado');
    }

    const { count } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('supermarket_id', id);

    if (count && count > 0) {
      throw new Error('Não é possível deletar supermercado com compras associadas');
    }

    const { error } = await supabase
      .from('supermarkets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  },

  async searchSupermarkets(query: string): Promise<Supermarket[]> {
    const userId = await getCurrentUserId();
    const supabase = getClient();

    const { data: supermarkets, error } = await supabase
      .from('supermarkets')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .ilike('name', `%${query}%`)
      .limit(10);

    if (error) {
      throw new Error(error.message);
    }

    return (supermarkets || []).map(s => ({
      id: s.id,
      name: s.name,
      cnpj: s.cnpj,
      city: s.city,
      state: s.state,
      isManual: s.manual,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  },
};
