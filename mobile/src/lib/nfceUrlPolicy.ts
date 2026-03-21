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

export const parseQrInput = (input: string): string => {
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/[?&]p=([^&]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].trim();
  }

  const pMatch = trimmed.match(/p=([^&|]+)/i);
  if (pMatch && pMatch[1]) {
    return pMatch[1].trim();
  }

  if (/^\d{44}/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 44) {
    return digits.substring(0, 44);
  }

  throw new Error('QR Code NFC-e inválido: não foi possível extrair a chave de acesso');
};

export const extractAccessKeyFromQRCode = (qrCodeData: string): string => {
  const pValue = parseQrInput(qrCodeData);
  const cleanKey = pValue.split('|')[0].trim();

  if (cleanKey.length !== 44) {
    throw new Error('Chave NFC-e inválida: deve ter 44 dígitos');
  }

  return cleanKey;
};

export const buildNFCeUrl = (input: string): string => {
  const pValue = parseQrInput(input);
  const accessKey = pValue.split('|')[0].trim();

  if (accessKey.length !== 44) {
    throw new Error('Chave NFC-e inválida: deve ter 44 dígitos');
  }

  const stateCode = accessKey.substring(0, 2);
  const baseUrl = STATE_URLS[stateCode] || STATE_URLS['43'];
  const pParam = stateCode === '43' ? pValue : accessKey;

  return `${baseUrl}?p=${pParam}`;
};

export const NFCE_ALLOWED_HOSTS = new Set<string>([
  ...Object.values(STATE_URLS).map((url) => new URL(url).hostname),
]);

export const NFCE_ALLOWED_PATH_PREFIXES: Record<string, string[]> = Object.values(STATE_URLS).reduce(
  (acc, url) => {
    const { hostname, pathname } = new URL(url);
    if (!acc[hostname]) {
      acc[hostname] = [];
    }
    if (!acc[hostname].includes(pathname)) {
      acc[hostname].push(pathname);
    }
    return acc;
  },
  {} as Record<string, string[]>,
);

export const isAllowedNfceUrl = (
  value: string,
  options?: {
    allowAboutBlank?: boolean;
    requireExpectedPath?: boolean;
  },
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

    return expectedPrefixes.some((prefix) => parsed.pathname.startsWith(prefix));
  } catch (error) {
    if (__DEV__) {
      console.error('Error validating NFCE URL:', error);
    }
    return false;
  }
};
