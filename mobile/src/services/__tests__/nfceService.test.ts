jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('../authService', () => ({
  getCurrentUserId: jest.fn(),
}));

import {
  buildNFCeUrl,
  extractAccessKeyFromQRCode,
  isAllowedNfceUrl,
  parseQrInput,
} from '../nfceService';

describe('nfceService QR parsing', () => {
  it('extrai parametro p de URL completa', () => {
    const p = parseQrInput('https://www.sefaz.rs.gov.br?foo=1&p=43180611111111111111111111111111111111111111|2|1|1|HASH');
    expect(p).toBe('43180611111111111111111111111111111111111111|2|1|1|HASH');
  });

  it('extrai chave de 44 digitos de payload valido', () => {
    const key = extractAccessKeyFromQRCode('43180611111111111111111111111111111111111111|2|1|1|HASH');
    expect(key).toBe('43180611111111111111111111111111111111111111');
  });

  it('lanca erro quando nao consegue extrair chave', () => {
    expect(() => parseQrInput('qr-invalido')).toThrow(/QR Code NFC-e inv[aá]lido/i);
  });
});

describe('nfceService URL and allowlist', () => {
  it('preserva payload completo para estado 43 (RS)', () => {
    const url = buildNFCeUrl('43180611111111111111111111111111111111111111|2|1|1|HASH');
    expect(url).toContain('dfe-portal.svrs.rs.gov.br');
    expect(url).toContain('43180611111111111111111111111111111111111111|2|1|1|HASH');
  });

  it('bloqueia URL com host fora da allowlist', () => {
    expect(isAllowedNfceUrl('https://malicious.example.com/path')).toBe(false);
  });
});
