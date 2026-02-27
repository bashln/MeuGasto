import { supabase } from '../lib/supabaseClient';
import { Rascunho, RascunhoFilter, CreateRascunhoRequest, UpdateRascunhoRequest } from '../types';
import { authService } from './authService';

const getCurrentUserId = async (): Promise<string> => {
  const { user } = await authService.getSession();
  if (!user?.id) {
    throw new Error('User not authenticated');
  }
  return user.id;
};

export const draftService = {
  async getDrafts(filter?: RascunhoFilter): Promise<{ data: Rascunho[]; page: any }> {
    const userId = await getCurrentUserId();

    let query = supabase
      .from('drafts')
      .select(`
        *,
        supermarket:supermarkets(*)
      `)
      .eq('user_id', userId);

    if (filter?.supermarketId) {
      query = query.eq('supermarket_id', filter.supermarketId);
    }

    const page = filter?.page || 0;
    const size = filter?.size || 20;
    const from = page * size;
    const to = from + size - 1;

    const { data: drafts, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: (drafts || []).map(d => ({
        id: d.id,
        supermarket: d.supermarket,
        conteudo: d.content,
        totalPrice: parseFloat(d.total_price) || 0,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
      page: {
        pageNumber: page,
        pageSize: size,
        totalElements: count || 0,
        totalPages: Math.ceil((count || 0) / size),
      },
    };
  },

  async getDraftById(id: number): Promise<Rascunho> {
    const userId = await getCurrentUserId();

    const { data: draft, error } = await supabase
      .from('drafts')
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

    return {
      id: draft.id,
      supermarket: draft.supermarket,
      conteudo: draft.content,
      totalPrice: parseFloat(draft.total_price) || 0,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
    };
  },

  async createDraft(data: CreateRascunhoRequest): Promise<Rascunho> {
    const userId = await getCurrentUserId();

    const { data: draft, error } = await supabase
      .from('drafts')
      .insert({
        user_id: userId,
        supermarket_id: data.supermarketId || null,
        content: data.conteudo,
        total_price: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return this.getDraftById(draft.id);
  },

  async updateDraft(id: number, data: UpdateRascunhoRequest): Promise<Rascunho> {
    const userId = await getCurrentUserId();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.conteudo !== undefined) updateData.content = data.conteudo;
    if (data.supermarketId !== undefined) updateData.supermarket_id = data.supermarketId;

    const { error } = await supabase
      .from('drafts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return this.getDraftById(id);
  },

  async deleteDraft(id: number): Promise<void> {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async convertDraftToPurchase(id: number): Promise<void> {
    // Funcionalidade não implementada ainda
    throw new Error('Convert draft to purchase not implemented yet');
  },
};
