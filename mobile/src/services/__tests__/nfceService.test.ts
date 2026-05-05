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
  buildExternalScraperPayload,
  buildNFCeUrl,
  extractAccessKeyFromQRCode,
  hashAccessKey,
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

  it('bloqueia URL sem HTTPS', () => {
    expect(isAllowedNfceUrl('http://www.sefaz.sc.gov.br/nfce/consulta?p=1')).toBe(false);
  });

  it('valida path esperado quando solicitado', () => {
    expect(
      isAllowedNfceUrl('https://www.sefaz.sc.gov.br/nfce/consulta?p=1', {
        requireExpectedPath: true,
      })
    ).toBe(true);

    expect(
      isAllowedNfceUrl('https://www.sefaz.sc.gov.br/outro?p=1', {
        requireExpectedPath: true,
      })
    ).toBe(false);
  });
});

describe('nfceService access key hashing', () => {
  const accessKey = '43180611111111111111111111111111111111111111';

  it('gera hash SHA-256 da chave de acesso', async () => {
    await expect(hashAccessKey(accessKey)).resolves.toBe(
      'e2a7bf2062ac05f46705ad51fa5c47d23f466241cadb69f3d1910a5020734d0a'
    );
  });

  it('monta payload do scraper externo com hash sem expor chave original', async () => {
    const payload = await buildExternalScraperPayload('https://www.sefaz.rs.gov.br/nfce', accessKey);

    expect(payload.nfceUrl).toBe('https://www.sefaz.rs.gov.br/nfce');
    expect(payload.accessKeyHash).toBe(
      'e2a7bf2062ac05f46705ad51fa5c47d23f466241cadb69f3d1910a5020734d0a'
    );
    expect(JSON.stringify(payload)).not.toContain(accessKey);
  });
});
