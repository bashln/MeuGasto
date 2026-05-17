import { RS_NFCE_SCRAPE_SCRIPT } from './states/rs';
import { RJ_NFCE_SCRAPE_SCRIPT } from './states/rj';

const DEFAULT_STATE_CODE = '43';

const STATE_SCRIPTS: Record<string, string> = {
  '33': RJ_NFCE_SCRAPE_SCRIPT,
  '43': RS_NFCE_SCRAPE_SCRIPT,
};

const extractStateCodeFromNfceUrl = (nfceUrl: string): string | null => {
  try {
    const parsed = new URL(nfceUrl);
    if (parsed.hostname === 'consultadfe.fazenda.rj.gov.br') {
      return '33';
    }
    const pParam = parsed.searchParams.get('p');

    if (!pParam) {
      return null;
    }

    const accessKey = pParam.split('|')[0]?.trim() ?? '';
    if (!/^\d{44}$/.test(accessKey)) {
      return null;
    }

    return accessKey.substring(0, 2);
  } catch {
    return null;
  }
};

const extractStateCodeFromAccessKey = (accessKey: string): string | null => {
  const normalized = (accessKey || '').trim();
  if (!/^\d{44}$/.test(normalized)) {
    return null;
  }

  return normalized.substring(0, 2);
};

export const getNfceScrapeScript = (nfceUrl: string): string => {
  const stateCode = extractStateCodeFromNfceUrl(nfceUrl) ?? DEFAULT_STATE_CODE;
  return STATE_SCRIPTS[stateCode] ?? STATE_SCRIPTS[DEFAULT_STATE_CODE];
};

export const getNfceScrapeScriptByAccessKey = (accessKey: string): string => {
  const stateCode = extractStateCodeFromAccessKey(accessKey) ?? DEFAULT_STATE_CODE;
  return STATE_SCRIPTS[stateCode] ?? STATE_SCRIPTS[DEFAULT_STATE_CODE];
};

export const NFCE_SCRAPE_SCRIPT = RS_NFCE_SCRAPE_SCRIPT;
