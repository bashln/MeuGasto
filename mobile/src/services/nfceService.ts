import { getSupabaseClient } from '../lib/supabaseClient';
import { NFCeScrapedData, validateAccessKey, validateAndSanitizeNFCePayload } from '../lib/nfcePayloadValidation';
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

const productCategorizer = new ProductCategorizerService({
  rules: DEFAULT_PRODUCT_CATEGORY_RULES,
  fallbackCategoryId: CATEGORY_IDS.OUTROS,
  persistence: {
    load: async () => {
      const userId = await getCurrentUserId().catch(() => null);
      if (!userId) {
        return [];
      }

      const supabase = getClient();
      const { data, error } = await supabase
        .from('learned_reclassifications')
        .select('normalized_name, category_id')
        .eq('user_id', userId);

      if (error || !data) {
        return [];
      }

      return data.map((entry: { normalized_name: string; category_id: number }) => ({
        productName: entry.normalized_name,
        categoryId: entry.category_id,
      }));
    },
    save: async () => {
      // Fluxo NFC-e só consome classificações aprendidas; persistência é feita na reclassificação manual.
    },
  },
});

export const hashAccessKey = async (accessKey: string): Promise<string> => {
  const sanitizedAccessKey = validateAccessKey(accessKey);
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error('SHA-256 indisponivel no ambiente atual');
  }

  const input = new TextEncoder().encode(sanitizedAccessKey);
  const digest = await subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const buildExternalScraperPayload = async (
  nfceUrl: string,
  accessKey: string
): Promise<{ nfceUrl: string; accessKeyHash: string }> => {
  return {
    nfceUrl,
    accessKeyHash: await hashAccessKey(accessKey),
  };
};


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

// Fonte oficial (produção): ENCAT NFC-e "URL por UF utilizada QR code"
// https://nfce.encat.org/desenvolvedor/qrcode/ (acesso em 2026-05-05)
const STATE_URLS: Record<string, string> = {
  '11': 'https://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp', // RO
  '12': 'https://www.sefaznet.ac.gov.br/nfce/qrcode', // AC
  '13': 'https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp', // AM
  '14': 'https://www.sefaz.rr.gov.br/nfce/servlet/qrcode', // RR
  '15': 'https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam', // PA
  '16': 'https://www.sefaz.ap.gov.br/nfce/nfcep.php', // AP
  '17': 'https://www.sefaz.to.gov.br/nfce/qrcode', // TO
  '21': 'https://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp', // MA
  '22': 'https://www.sefaz.pi.gov.br/nfce/qrcode', // PI
  '23': 'https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html', // CE
  '24': 'https://nfce.set.rn.gov.br/consultarNFCe.aspx', // RN
  '25': 'https://www.sefaz.pb.gov.br/nfce', // PB
  '26': 'https://nfce.sefaz.pe.gov.br/nfce/consulta', // PE
  '27': 'https://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp', // AL
  '28': 'https://www.nfce.se.gov.br/nfce/qrcode', // SE
  '29': 'https://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx', // BA
  '31': 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml', // MG
  '32': 'https://app.sefaz.es.gov.br/ConsultaNFCe', // ES
  '33': 'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode', // RJ
  '35': 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx', // SP
  '41': 'https://www.fazenda.pr.gov.br/nfce/qrcode', // PR
  '42': 'https://sat.sef.sc.gov.br/nfce/consulta', // SC
  '43': 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx', // RS
  '50': 'https://www.dfe.ms.gov.br/nfce/qrcode', // MS
  '51': 'https://www.sefaz.mt.gov.br/nfce/consultanfce', // MT
  '52': 'https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe', // GO
  '53': 'https://www.fazenda.df.gov.br/nfce/qrcode', // DF
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
  ...Object.values(STATE_URLS).map(url => new URL(url).hostname),
]);

export const NFCE_ALLOWED_PATH_PREFIXES: Record<string, string[]> = Object.values(STATE_URLS).reduce(
  (acc, url) => {
    const { hostname, pathname } = new URL(url);
    if (!acc[hostname]) acc[hostname] = [];
    if (!acc[hostname].includes(pathname)) acc[hostname].push(pathname);
    return acc;
  },
  {} as Record<string, string[]>,
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
  const supabase = getClient();
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
  async createPurchaseFromScrapedData(
    scrapedData: unknown,
    accessKey: string,
    supermarketId?: number
  ): Promise<{
    purchaseId: number;
    total: number;
    itemCount: number;
  }> {
    await productCategorizer.ready();
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

    const itemsPayload = sanitizedPayload.items.map(item => ({
      name: item.name,
      code: '',
      category_id: productCategorizer.categorizeProduct(item.name),
      quantity: item.quantity,
      unit: item.unit,
      price: item.unityPrice ?? item.totalPrice ?? 0,
    }));

    const { data: createdPurchase, error: purchaseError } = await supabase.rpc('create_purchase_with_items', {
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
      total: sanitizedPayload.total,
      itemCount: sanitizedPayload.items.length,
    };
  },
};

export const resetNFCeProductCategorizer = (): Promise<void> => productCategorizer.reload();
