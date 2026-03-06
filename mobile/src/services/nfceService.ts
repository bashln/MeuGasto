import { supabase } from '../lib/supabaseClient';
import { NFCeScrapedData, validateAccessKey, validateAndSanitizeNFCePayload } from '../lib/nfcePayloadValidation';
import { getCurrentUserId } from './authService';

const DEFAULT_SCRAPER_URL = 'https://nfce-scraper.herokuapp.com';

const normalizeScraperBaseUrl = (value?: string): string => {
  if (!value?.trim()) {
    return DEFAULT_SCRAPER_URL;
  }

  const input = value.trim();
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SCRAPER_URL;
  }
};

export const NFCE_SCRAPER_BASE_URL = normalizeScraperBaseUrl(
  process.env.NFCE_SCRAPER_URL || process.env.EXPO_PUBLIC_NFCE_SCRAPER_URL
);

const SCRAPER_HOST = new URL(NFCE_SCRAPER_BASE_URL).hostname;

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

const STATE_URLS: Record<string, string> = {
  '11': 'https://www.sefaz.am.gov.br/nfce/consulta',
  '12': 'https://www.sefaz.ac.gov.br/nfce/consulta',
  '13': 'https://www.sefaz.ap.gov.br/nfce/consulta',
  '14': 'https://www.sefaz.se.gov.br/nfce/consulta',
  '15': 'https://www.sefaz.to.gov.br/nfce/consulta',
  '16': 'https://www.fazenda.ma.gov.br/nfce/consulta',
  '17': 'https://www.sefaz.pi.gov.br/nfce/consulta',
  '21': 'https://www.fazenda.mg.gov.br/nfce/consulta',
  '22': 'https://www.sefaz.es.gov.br/nfce/consulta',
  '23': 'https://www.sefaz.rj.gov.br/nfce/consulta',
  '24': 'https://www.sefaz.rj.gov.br/nfce/consulta',
  '25': 'https://www.sefaz.pb.gov.br/nfce/consulta',
  '26': 'https://www.sefaz.pe.gov.br/nfce/consulta',
  '27': 'https://www.sefaz.al.gov.br/nfce/consulta',
  '28': 'https://www.sefaz.ba.gov.br/nfce/consulta',
  '29': 'https://www.sefaz.se.gov.br/nfce/consulta',
  '31': 'https://www.sefaz.mt.gov.br/nfce/consulta',
  '32': 'https://www.sefaz.ms.gov.br/nfce/consulta',
  '33': 'https://www.sefaz.rj.gov.br/nfce/consulta',
  '35': 'https://www.fazenda.sp.gov.br/nfce/consulta',
  '41': 'https://www.fazenda.pr.gov.br/nfce/consulta',
  '42': 'https://www.sefaz.sc.gov.br/nfce/consulta',
  '43': 'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce',
  '50': 'https://www.sefaz.go.gov.br/nfce/consulta',
  '51': 'https://www.sefaz.mt.gov.br/nfce/consulta',
  '52': 'https://www.sefaz.ro.gov.br/nfce/consulta',
  '53': 'https://www.sefaz.to.gov.br/nfce/consulta',
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
  const baseUrl = STATE_URLS[stateCode] || STATE_URLS['43'];

  // Para RS (43), preserva o p completo (chave + metadados)
  // Para outros estados, usa só a chave
  const pParam = stateCode === '43' ? pValue : accessKey;

  return `${baseUrl}?p=${pParam}`;
};

// Derive allowed hosts and path prefixes from STATE_URLS (single source of truth)
export const NFCE_ALLOWED_HOSTS = new Set<string>([
  SCRAPER_HOST,
  ...Object.values(STATE_URLS).map(url => new URL(url).hostname),
]);

export const NFCE_ALLOWED_PATH_PREFIXES: Record<string, string[]> = Object.values(STATE_URLS).reduce(
  (acc, url) => {
    const { hostname, pathname } = new URL(url);
    if (!acc[hostname]) acc[hostname] = [];
    if (!acc[hostname].includes(pathname)) acc[hostname].push(pathname);
    return acc;
  },
  { [SCRAPER_HOST]: ['/nfce'] } as Record<string, string[]>,
);

export const isAllowedNfceUrl = (
  value: string,
  options?: {
    allowAboutBlank?: boolean;
    requireExpectedPath?: boolean;
  }
): boolean => {
  const allowAboutBlank = options?.allowAboutBlank ?? false;
  const requireExpectedPath = options?.requireExpectedPath ?? false;

  if (allowAboutBlank && value === 'about:blank') {
    return true;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    if (!NFCE_ALLOWED_HOSTS.has(parsed.hostname)) {
      return false;
    }

    if (!requireExpectedPath) {
      return true;
    }

    const expectedPrefixes = NFCE_ALLOWED_PATH_PREFIXES[parsed.hostname];
    if (!expectedPrefixes || expectedPrefixes.length === 0) {
      return true;
    }

    return expectedPrefixes.some(prefix => parsed.pathname.startsWith(prefix));
  } catch {
    return false;
  }
};

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
  let actualSupermarketId = supermarketId;

  if (!actualSupermarketId && data.cnpj) {
    const cnpjDigits = normalizeCnpj(data.cnpj);

    if (data.allowCnpjLikeMatch && cnpjDigits) {
      const { data: existingCnpj } = await supabase
        .from('supermarkets')
        .select('id')
        .like('cnpj', `%${cnpjDigits}%`)
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
  async consultQRCode(qrCodeData: string): Promise<NFCeData> {
    const accessKey = extractAccessKeyFromQRCode(qrCodeData);
    if (__DEV__) {
      console.warn('Chave extraída:', accessKey, '- Comprimento:', accessKey.length);
    }
    
    const url = buildNFCeUrl(qrCodeData);

    if (__DEV__) {
      console.warn('Consultando NFC-e com URL:', url);
    }

    try {
      const response = await fetch(
        `${NFCE_SCRAPER_BASE_URL}/nfce?nfce_url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const items: NFCeItem[] = await response.json();

      if (__DEV__) {
        console.warn('Items recebidos:', items);
      }

      if (!items || items.length === 0) {
        throw new Error('Nenhum item encontrado na nota fiscal.');
      }

      const total = items.reduce((sum, item) => sum + item.price, 0);

      return {
        items,
        total,
        date: new Date().toISOString().split('T')[0],
      };
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn('Erro na consulta NFC-e:', error);
      }
      if (error instanceof Error && error.message.includes('Nenhum item')) {
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

    const actualSupermarketId = await findOrCreateSupermarket(userId, supermarketId, {
      cnpj: nfceData.supermarket?.cnpj,
      requireNonManual: true,
      createIfMissing: false,
    });

    const itemsPayload = nfceData.items.map(item => ({
      name: item.item,
      code: item.id.toString(),
      quantity: item.amount,
      unit: item.unity,
      price: item.unity_price,
    }));

    const { data: createdPurchase, error: purchaseError } = await supabase.rpc('create_purchase_with_items', {
      p_user_id: userId,
      p_supermarket_id: actualSupermarketId || null,
      p_access_key: accessKey,
      p_date: nfceData.date || new Date().toISOString().split('T')[0],
      p_total_price: nfceData.total,
      p_manual: false,
      p_items: itemsPayload,
    });

    if (purchaseError) {
      throw new Error(purchaseError.message);
    }

    const purchaseId = createdPurchase?.[0]?.purchase_id;

    if (!purchaseId) {
      throw new Error('Não foi possível criar a compra da NFC-e');
    }

    return {
      purchaseId,
      accessKey,
      total: nfceData.total,
      itemCount: nfceData.items.length,
    };
  },

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

    const itemsPayload = sanitizedPayload.items.map(item => ({
      name: item.name,
      code: '',
      quantity: item.quantity,
      unit: item.unit,
      price: item.totalPrice ?? item.unityPrice ?? 0,
    }));

    const { data: createdPurchase, error: purchaseError } = await supabase.rpc('create_purchase_with_items', {
      p_user_id: userId,
      p_supermarket_id: actualSupermarketId || null,
      p_access_key: sanitizedAccessKey,
      p_date: purchaseDate,
      p_total_price: sanitizedPayload.total,
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
      total: sanitizedPayload.total,
      itemCount: sanitizedPayload.items.length,
    };
  },
};
