import { NFCeScrapedData } from '../lib/nfcePayloadValidation';
import { isAllowedNfceUrl } from './nfceService';

const RJ_HOST = 'consultadfe.fazenda.rj.gov.br';
const REQUEST_TIMEOUT_MS = 15000;
const RJ_COMPAT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

type HttpImportResult =
  | { ok: true; data: NFCeScrapedData; accessKey?: string }
  | { ok: false; error: string };

const decodeHtmlEntities = (value: string): string => {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&Ccedil;/g, 'Ç');
};

const stripTags = (value: string): string =>
  decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const parseMoneyBR = (value: string): number => {
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const parseQty = (value: string): number => {
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const extractAccessKey = (html: string): string => {
  const key = (html.match(/<span[^>]*class="chave"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '')
    .replace(/\D/g, '')
    .trim();
  return key.length === 44 ? key : '';
};

export const parseRjHtml = (html: string): NFCeScrapedData | null => {
  const storeName = stripTags(html.match(/<div[^>]*id="u20"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '');
  const cnpj = (html.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0] || '').trim();
  const emittedAt = (
    html.match(/Emiss(?:&atilde;|ã)o:\s*<\/strong>\s*([\d/:\-\s]+)/i)?.[1] ||
    html.match(/Emiss(?:&atilde;|ã)o:\s*([\d/:\-\s]+)/i)?.[1] ||
    ''
  )
    .replace(/\s+-\s+Via.*$/i, '')
    .trim();

  const totalRaw = html.match(/<span[^>]*class="totalNumb\s+txtMax"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '';
  const total = parseMoneyBR(stripTags(totalRaw));

  const itemRows = Array.from(
    html.matchAll(/<tr[^>]*id="Item \+ \d+"[^>]*>([\s\S]*?)<\/tr>/gi)
  ).map(match => match[1]);

  const items = itemRows
    .map(rowHtml => {
      const name = stripTags(rowHtml.match(/<span[^>]*class="txtTit"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
      const qty = parseQty(
        stripTags(rowHtml.match(/<span[^>]*class="Rqtd"[^>]*>[\s\S]*?([\d.,]+)\s*<\/span>/i)?.[1] || '1')
      );
      const unit = (
        stripTags(rowHtml.match(/<span[^>]*class="RUN"[^>]*>[\s\S]*?([A-Z]{1,5})\s*<\/span>/i)?.[1] || 'UN') || 'UN'
      ).toUpperCase();
      const unityPrice = parseMoneyBR(
        stripTags(rowHtml.match(/<span[^>]*class="RvlUnit"[^>]*>[\s\S]*?([\d.,]+)\s*<\/span>/i)?.[1] || '0')
      );
      const totalPrice = parseMoneyBR(
        stripTags(rowHtml.match(/<span[^>]*class="valor"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '0')
      );

      if (!name) return null;

      return {
        name,
        quantity: qty || 1,
        unit: unit || 'UN',
        unityPrice: unityPrice || (qty > 0 ? totalPrice / qty : totalPrice) || 0,
        totalPrice: totalPrice || 0,
      };
    })
    .filter(Boolean) as NFCeScrapedData['items'];

  if (!storeName || items.length === 0 || total <= 0) {
    return null;
  }

  return {
    storeName,
    cnpj,
    accessKey: extractAccessKey(html),
    emittedAt,
    city: '',
    state: 'RJ',
    total,
    items,
  };
};

const detectRjAntiBot = (html: string): string | null => {
  const lower = (html || '').toLowerCase();
  if (
    lower.includes('/tspd/?type=') ||
    lower.includes('apm_do_not_touch') ||
    lower.includes('loaderconfig') ||
    lower.includes('window._z.iol') ||
    lower.includes('erro no campo qr code do xml')
  ) {
    return 'Portal RJ retornou página protegida/anti-bot (TSPD), não o conteúdo final da NFC-e.';
  }

  return null;
};

export const nfceHttpImportService = {
  async tryImport(url: string): Promise<HttpImportResult> {
    if (!isAllowedNfceUrl(url)) {
      return { ok: false, error: 'URL NFC-e bloqueada por seguranca.' };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: 'URL NFC-e inválida.' };
    }

    if (parsed.hostname !== RJ_HOST) {
      return { ok: false, error: 'HTTP import ainda não suportado para este estado.' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': RJ_COMPAT_USER_AGENT,
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, error: `Erro HTTP ${response.status} ao consultar NFC-e.` };
      }

      const html = await response.text();
      const antiBotReason = detectRjAntiBot(html);
      if (antiBotReason) {
        return { ok: false, error: antiBotReason };
      }

      const parsedData = parseRjHtml(html);
      if (!parsedData) {
        const compact = stripTags(html).slice(0, 180);
        return {
          ok: false,
          error: `Nao foi possivel extrair dados via HTTP. Prévia da resposta: "${compact}"`,
        };
      }

      const accessKey = parsedData.accessKey;
      return { ok: true, data: parsedData, accessKey: accessKey || undefined };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { ok: false, error: 'Tempo limite excedido na consulta HTTP da NFC-e.' };
      }
      return { ok: false, error: 'Falha de rede na consulta HTTP da NFC-e.' };
    } finally {
      clearTimeout(timeout);
    }
  },
};
