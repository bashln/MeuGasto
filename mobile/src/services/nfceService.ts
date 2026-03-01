import { supabase } from '../lib/supabaseClient';
import { getCurrentUserId } from './authService';

interface NFCeItem {
  item: string;
  id: number;
  unity: string;
  amount: number;
  unity_price: number;
  price: number;
}

interface NFCeData {
  items: NFCeItem[];
  total: number;
  supermarket?: {
    name: string;
    cnpj?: string;
    city?: string;
    state?: string;
  };
  date?: string;
}

export const extractAccessKeyFromQRCode = (qrCodeData: string): string => {
  const pValue = parseQrInput(qrCodeData);
  const cleanKey = pValue.split('|')[0].trim();
  
  if (cleanKey.length !== 44) {
    throw new Error('Chave NFC-e inválida: deve ter 44 dígitos');
  }
  
  return cleanKey;
};

export const parseQrInput = (input: string): string => {
  const trimmed = input.trim();
  
  // Se é URL completa com ?p=..., extrai o valor de p
  const urlMatch = trimmed.match(/[?&]p=([^&]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].trim();
  }
  
  // Se contém p= mas não é URL completa
  const pMatch = trimmed.match(/p=([^&|]+)/i);
  if (pMatch && pMatch[1]) {
    return pMatch[1].trim();
  }
  
  // Se é payload cru (começa com 43...|...), retorna como está
  if (/^\d{44}/.test(trimmed)) {
    return trimmed;
  }
  
  // Tenta extrair só os dígitos
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 44) {
    return digits.substring(0, 44);
  }
  
  throw new Error('QR Code NFC-e inválido: não foi possível extrair a chave de acesso');
};

export const buildNFCeUrl = (input: string): string => {
  // Obter o valor de p (pode ter 44 dígitos ou 44 + |versão|ambiente|tipo|hash)
  const pValue = parseQrInput(input);
  
  // Extrair a chave (44 dígitos) para determinar o estado
  const accessKey = pValue.split('|')[0].trim();
  
  if (accessKey.length !== 44) {
    throw new Error('Chave NFC-e inválida: deve ter 44 dígitos');
  }
  
  const stateCode = accessKey.substring(0, 2);
  
  // URLs por estado
  const stateUrls: Record<string, string> = {
    '11': 'http://www.sefaz.am.gov.br/nfce/consulta',
    '12': 'http://www.sefaz.ac.gov.br/nfce/consulta',
    '13': 'http://www.sefaz.ap.gov.br/nfce/consulta',
    '14': 'http://www.sefaz.se.gov.br/nfce/consulta',
    '15': 'http://www.sefaz.to.gov.br/nfce/consulta',
    '16': 'http://www.fazenda.ma.gov.br/nfce/consulta',
    '17': 'http://www.sefaz.pi.gov.br/nfce/consulta',
    '21': 'http://www.fazenda.mg.gov.br/nfce/consulta',
    '22': 'http://www.sefaz.es.gov.br/nfce/consulta',
    '23': 'http://www.sefaz.rj.gov.br/nfce/consulta',
    '24': 'http://www.sefaz.rj.gov.br/nfce/consulta',
    '25': 'http://www.sefaz.pb.gov.br/nfce/consulta',
    '26': 'http://www.sefaz.pe.gov.br/nfce/consulta',
    '27': 'http://www.sefaz.al.gov.br/nfce/consulta',
    '28': 'http://www.sefaz.ba.gov.br/nfce/consulta',
    '29': 'http://www.sefaz.se.gov.br/nfce/consulta',
    '31': 'http://www.sefaz.mt.gov.br/nfce/consulta',
    '32': 'http://www.sefaz.ms.gov.br/nfce/consulta',
    '33': 'http://www.sefaz.rj.gov.br/nfce/consulta',
    '35': 'http://www.fazenda.sp.gov.br/nfce/consulta',
    '41': 'http://www.fazenda.pr.gov.br/nfce/consulta',
    '42': 'http://www.sefaz.sc.gov.br/nfce/consulta',
    '43': 'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce',
    '50': 'http://www.sefaz.go.gov.br/nfce/consulta',
    '51': 'http://www.sefaz.mt.gov.br/nfce/consulta',
    '52': 'http://www.sefaz.ro.gov.br/nfce/consulta',
    '53': 'http://www.sefaz.to.gov.br/nfce/consulta',
  };

  const baseUrl = stateUrls[stateCode] || stateUrls['43'];
  
  // Para RS (43), preserva o p completo (chave + metadados)
  // Para outros estados, usa só a chave
  const pParam = stateCode === '43' ? pValue : accessKey;
  
  return `${baseUrl}?p=${pParam}`;
};

const normalizeQrCodeToUrl = (qrCodeData: string): string => {
  // Agora buildNFCeUrl já faz todo o trabalho de parsing
  return buildNFCeUrl(qrCodeData);
};

export const nfceService = {
  async consultQRCode(qrCodeData: string): Promise<NFCeData> {
    const accessKey = extractAccessKeyFromQRCode(qrCodeData);
    console.log('Chave extraída:', accessKey, '- Comprimento:', accessKey.length);
    
    if (accessKey.length !== 44) {
      throw new Error('Chave de acesso inválida. Deve ter 44 dígitos.');
    }
    const url = normalizeQrCodeToUrl(qrCodeData);

    console.log('Consultando NFC-e com URL:', url);

    try {
      const response = await fetch(
        `https://nfce-scraper.herokuapp.com/nfce?nfce_url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const items: NFCeItem[] = await response.json();

      console.log('Items recebidos:', items);

      if (!items || items.length === 0) {
        throw new Error('Nenhum item encontrado na nota fiscal.');
      }

      const total = items.reduce((sum, item) => sum + item.price, 0);

      return {
        items,
        total,
        date: new Date().toISOString().split('T')[0],
      };
    } catch (error: any) {
      console.log('Erro na consulta NFC-e:', error);
      if (error.message.includes('Nenhum item')) {
        throw error;
      }
      throw new Error('Erro ao consultar nota fiscal. Verifique a chave de acesso.');
    }
  },

  async createPurchaseFromNFCe(
    qrCodeData: string,
    supermarketId?: number
  ): Promise<{
    purchaseId: number;
    accessKey: string;
    total: number;
    itemCount: number;
  }> {
    const userId = await getCurrentUserId();

    const nfceData = await this.consultQRCode(qrCodeData);
    const accessKey = extractAccessKeyFromQRCode(qrCodeData);

    let actualSupermarketId = supermarketId;

    if (!actualSupermarketId) {
      const supermarketInfo = nfceData.supermarket;
      if (supermarketInfo?.cnpj) {
        const { data: existing } = await supabase
          .from('supermarkets')
          .select('id')
          .eq('cnpj', supermarketInfo.cnpj)
          .eq('manual', false)
          .limit(1)
          .single();

        if (existing) {
          actualSupermarketId = existing.id;
        }
      }

    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        supermarket_id: actualSupermarketId || null,
        access_key: accessKey,
        date: nfceData.date || new Date().toISOString().split('T')[0],
        total_price: nfceData.total,
        manual: false,
      })
      .select()
      .single();

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    if (nfceData.items.length > 0) {
      const itemsToInsert = nfceData.items.map(item => ({
        purchase_id: purchase.id,
        name: item.item,
        code: item.id.toString(),
        quantity: item.amount,
        unit: item.unity,
        price: item.unity_price,
      }));

      const { error: itemsError } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(itemsError.message);
      }
    }

    return {
      purchaseId: purchase.id,
      accessKey,
      total: nfceData.total,
      itemCount: nfceData.items.length,
    };
  },

  async createPurchaseFromScrapedData(
    scrapedData: {
      storeName?: string;
      cnpj?: string;
      emittedAt?: string;
      city?: string;
      state?: string;
      total: number;
      items: Array<{
        name: string;
        quantity: number;
        unit: string;
        unityPrice?: number;
        totalPrice?: number;
      }>;
    },
    accessKey: string,
    supermarketId?: number
  ): Promise<{
    purchaseId: number;
    accessKey: string;
    total: number;
    itemCount: number;
  }> {
    const userId = await getCurrentUserId();

    let actualSupermarketId = supermarketId;

    // Helper para normalizar CNPJ (remove pontuação)
    const normalizeCnpj = (cnpj?: string): string | null => {
      if (!cnpj) return null;
      return cnpj.replace(/\D/g, '');
    };

    // Tentar encontrar supermercado existente pelo CNPJ
    if (!actualSupermarketId && scrapedData.cnpj) {
      const cnpjDigits = normalizeCnpj(scrapedData.cnpj);
      if (cnpjDigits) {
        // Primeiro tenta buscar pelo CNPJ com dígitos
        const { data: existingCnpj } = await supabase
          .from('supermarkets')
          .select('id')
          .like('cnpj', `%${cnpjDigits}%`)
          .limit(1)
          .single();
        
        if (existingCnpj) {
          actualSupermarketId = existingCnpj.id;
        } else {
          // Tenta pelo CNPJ com pontuação original
          const { data: existing } = await supabase
            .from('supermarkets')
            .select('id')
            .eq('cnpj', scrapedData.cnpj)
            .limit(1)
            .single();
          
          if (existing) {
            actualSupermarketId = existing.id;
          }
        }
      }
    }

    // Criar supermercado automaticamente se não existir
    if (!actualSupermarketId && scrapedData.storeName) {
      const { data: created, error: createError } = await supabase
        .from('supermarkets')
        .insert({
          name: scrapedData.storeName,
          cnpj: scrapedData.cnpj || null,
          city: scrapedData.city || null,
          state: scrapedData.state || null,
          manual: false,
          user_id: userId,
        })
        .select()
        .single();

      if (!createError && created) {
        actualSupermarketId = created.id;
      }
    }

    // Parse emittedAt para data (formato: DD/MM/YYYY HH:MM:SS)
    let purchaseDate = new Date().toISOString().split('T')[0];
    if (scrapedData.emittedAt) {
      const match = scrapedData.emittedAt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        purchaseDate = `${match[3]}-${match[2]}-${match[1]}`;
      }
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: userId,
        supermarket_id: actualSupermarketId || null,
        access_key: accessKey,
        date: purchaseDate,
        total_price: scrapedData.total,
        manual: false,
      })
      .select()
      .single();

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    if (scrapedData.items && scrapedData.items.length > 0) {
      const itemsToInsert = scrapedData.items.map(item => ({
        purchase_id: purchase.id,
        name: item.name.substring(0, 200),
        code: '',
        quantity: item.quantity || 1,
        unit: item.unit || 'UN',
        price: item.totalPrice || item.unityPrice || 0,
      }));

      const { error: itemsError } = await supabase
        .from('items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(itemsError.message);
      }
    }

    return {
      purchaseId: purchase.id,
      accessKey,
      total: scrapedData.total,
      itemCount: scrapedData.items?.length || 0,
    };
  },
};