import { getSupabaseClient } from '../lib/supabaseClient';
import { NFCeScrapedData, validateAccessKey, validateAndSanitizeNFCePayload } from '../lib/nfcePayloadValidation';
import {
  buildNFCeUrl,
  extractAccessKeyFromQRCode,
  isAllowedNfceUrl,
  parseQrInput,
} from '../lib/nfceUrlPolicy';
import { getCurrentUserId } from './authService';
import { SupabaseClient } from '@supabase/supabase-js';

const getClient = (): SupabaseClient => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado');
  }
  return client;
};

export { buildNFCeUrl, extractAccessKeyFromQRCode, isAllowedNfceUrl, parseQrInput };

const normalizeCnpj = (cnpj?: string): string | null => {
  if (!cnpj) {
    return null;
  }

  return cnpj.replace(/\D/g, '');
};

const findOrCreateSupermarket = async (
  userId: string,
  supermarketId: number | undefined,
  data: {
    storeName?: string;
    cnpj?: string;
    city?: string;
    state?: string;
    requireNonManual?: boolean;
    allowCnpjLikeMatch?: boolean;
    createIfMissing?: boolean;
  }
): Promise<number | undefined> => {
  const supabase = getClient();
  let actualSupermarketId = supermarketId;

  if (!actualSupermarketId && data.cnpj) {
    const cnpjDigits = normalizeCnpj(data.cnpj);

    if (data.allowCnpjLikeMatch && cnpjDigits && cnpjDigits.length >= 8) {
      const escapedCnpj = cnpjDigits.replace(/[%_\\]/g, '\\$&');
      const { data: existingCnpj } = await supabase
        .from('supermarkets')
        .select('id')
        .like('cnpj', `%${escapedCnpj}%`)
        .limit(1)
        .single();

      if (existingCnpj) {
        actualSupermarketId = existingCnpj.id;
      }
    }

    if (!actualSupermarketId) {
      let query = supabase
        .from('supermarkets')
        .select('id')
        .eq('cnpj', data.cnpj)
        .limit(1);

      if (data.requireNonManual) {
        query = query.eq('manual', false);
      }

      const { data: existing } = await query.single();

      if (existing) {
        actualSupermarketId = existing.id;
      }
    }
  }

  if (!actualSupermarketId && data.createIfMissing && data.storeName) {
    const { data: created, error: createError } = await supabase
      .from('supermarkets')
      .insert({
        name: data.storeName,
        cnpj: data.cnpj || null,
        city: data.city || null,
        state: data.state || null,
        manual: false,
        user_id: userId,
      })
      .select()
      .single();

    if (!createError && created) {
      actualSupermarketId = created.id;
    }
  }

  return actualSupermarketId;
};

export const nfceService = {
  async createPurchaseFromScrapedData(
    scrapedData: unknown,
    accessKey: string,
    supermarketId?: number
  ): Promise<{
    purchaseId: number;
    accessKey: string;
    total: number;
    itemCount: number;
  }> {
    const supabase = getClient();
    const userId = await getCurrentUserId();
    const sanitizedPayload: NFCeScrapedData = validateAndSanitizeNFCePayload(scrapedData);
    const sanitizedAccessKey = validateAccessKey(accessKey);

    const actualSupermarketId = await findOrCreateSupermarket(userId, supermarketId, {
      storeName: sanitizedPayload.storeName,
      cnpj: sanitizedPayload.cnpj,
      city: sanitizedPayload.city,
      state: sanitizedPayload.state,
      allowCnpjLikeMatch: true,
      createIfMissing: true,
    });

    // Parse emittedAt para data (formato: DD/MM/YYYY HH:MM:SS)
    let purchaseDate = new Date().toISOString().split('T')[0];
    if (sanitizedPayload.emittedAt) {
      const match = sanitizedPayload.emittedAt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        purchaseDate = `${match[3]}-${match[2]}-${match[1]}`;
      }
    }

    const itemsPayload = sanitizedPayload.items.map((item) => {
      const resolvedPrice = item.unityPrice ?? (
        item.totalPrice !== undefined && item.quantity > 0
          ? Number((item.totalPrice / item.quantity).toFixed(2))
          : 0
      );

      return {
        name: item.name,
        code: '',
        quantity: item.quantity,
        unit: item.unit,
        price: resolvedPrice,
      };
    });
    const resolvedTotal = Number(
      itemsPayload.reduce((sum, item) => sum + item.quantity * item.price, 0).toFixed(2)
    );

    const { data: createdPurchase, error: purchaseError } = await supabase.rpc('create_purchase_with_items', {
      p_supermarket_id: actualSupermarketId || null,
      p_access_key: sanitizedAccessKey,
      p_date: purchaseDate,
      p_total_price: resolvedTotal,
      p_manual: false,
      p_items: itemsPayload,
    });

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    const purchaseId = createdPurchase?.[0]?.purchase_id;

    if (!purchaseId) {
      throw new Error('Não foi possível criar a compra importada');
    }

    return {
      purchaseId,
      accessKey: sanitizedAccessKey,
      total: resolvedTotal,
      itemCount: sanitizedPayload.items.length,
    };
  },
};
