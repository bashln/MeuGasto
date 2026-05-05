jest.mock('../../lib/supabaseClient', () => {
  const mockClient = {
    from: jest.fn(),
    rpc: jest.fn(),
  };
  return {
    supabase: mockClient,
    getSupabaseClient: jest.fn().mockReturnValue(mockClient),
    isSupabaseConfigured: jest.fn().mockReturnValue(true),
  };
});

jest.mock('../authService', () => ({
  getCurrentUserId: jest.fn(),
}));

import {
  buildExternalScraperPayload,
  buildNFCeUrl,
  extractAccessKeyFromQRCode,
  hashAccessKey,
  isAllowedNfceUrl,
  nfceService,
  parseQrInput,
} from '../nfceService';
import { supabase } from '../../lib/supabaseClient';

const mockFrom = supabase!.from as jest.Mock;
const mockRpc = supabase!.rpc as jest.Mock;

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
  it('usa endpoint da UF correta para cUFs sem duplicacao incorreta', () => {
    const rrUrl = buildNFCeUrl('14180611111111111111111111111111111111111111');
    const baUrl = buildNFCeUrl('29180611111111111111111111111111111111111111');
    const piUrl = buildNFCeUrl('22180611111111111111111111111111111111111111');
    const rjUrl = buildNFCeUrl('33180611111111111111111111111111111111111111');

    expect(rrUrl).toContain('sefaz.rr.gov.br');
    expect(baUrl).toContain('sefaz.ba.gov.br');
    expect(piUrl).toContain('sefaz.pi.gov.br');
    expect(rjUrl).toContain('fazenda.rj.gov.br');
  });

  it('preserva payload completo para estado 43 (RS)', () => {
    const url = buildNFCeUrl('43180611111111111111111111111111111111111111|2|1|1|HASH');
    expect(url).toContain('sefaz.rs.gov.br/NFCE/NFCE-COM.aspx');
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
      isAllowedNfceUrl('https://sat.sef.sc.gov.br/nfce/consulta?p=1', {
        requireExpectedPath: true,
      })
    ).toBe(true);

    expect(
      isAllowedNfceUrl('https://sat.sef.sc.gov.br/outro?p=1', {
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

describe('nfceService purchase creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('popula category_id nos itens ao criar compra por NFC-e', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 11 }, error: null }),
    };
    mockFrom.mockReturnValue(chain);
    mockRpc.mockResolvedValue({ data: [{ purchase_id: 91 }], error: null });

    const result = await nfceService.createPurchaseFromScrapedData(
      {
        total: 14.9,
        emittedAt: '03/05/2026 10:32:00',
        cnpj: '12345678000195',
        storeName: 'Mercado Teste',
        city: 'Curitiba',
        state: 'PR',
        items: [{ name: 'Shampoo Anticaspa', quantity: 1, unit: 'UN', unityPrice: 14.9 }],
      },
      '43180611111111111111111111111111111111111111'
    );

    expect(result.purchaseId).toBe(91);
    expect(mockRpc).toHaveBeenCalledWith(
      'create_purchase_with_items',
      expect.objectContaining({
        p_items: [
          expect.objectContaining({
            name: 'Shampoo Anticaspa',
            category_id: expect.any(Number),
          }),
        ],
      })
    );
  });
});
