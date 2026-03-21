jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
  getSupabaseClient: jest.fn().mockReturnValue({
    from: jest.fn(),
    rpc: jest.fn(),
  }),
}));

jest.mock('../authService', () => ({
  getCurrentUserId: jest.fn(),
}));

import {
  buildNFCeUrl,
  extractAccessKeyFromQRCode,
  isAllowedNfceUrl,
  nfceService,
  parseQrInput,
} from '../nfceService';
import { getCurrentUserId } from '../authService';
import { getSupabaseClient } from '../../lib/supabaseClient';

const mockClient = getSupabaseClient() as unknown as { from: jest.Mock; rpc: jest.Mock };
const mockRpc = mockClient.rpc as jest.Mock;
const mockGetCurrentUserId = getCurrentUserId as jest.Mock;

describe('nfceService QR parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue('user-1');
  });

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

  it('persiste quantidade e preco unitario corretos ao criar compra importada', async () => {
    mockRpc.mockResolvedValue({
      data: [{ purchase_id: 321 }],
      error: null,
    });

    const accessKey = '43180611111111111111111111111111111111111111';
    const result = await nfceService.createPurchaseFromScrapedData(
      {
        storeName: 'Mercearia Exemplo',
        total: 15.95,
        items: [
          {
            name: 'CERVEJA PROIBIDA 473ML PILSEN (Código: 1570 )',
            quantity: 5,
            unit: 'UN',
            unityPrice: 3.19,
            totalPrice: 15.95,
          },
        ],
      },
      accessKey,
      99,
    );

    expect(mockRpc).toHaveBeenCalledWith(
      'create_purchase_with_items',
      expect.objectContaining({
        p_supermarket_id: 99,
        p_access_key: accessKey,
        p_items: [
          {
            name: 'CERVEJA PROIBIDA 473ML PILSEN (Código: 1570 )',
            code: '',
            quantity: 5,
            unit: 'UN',
            price: 3.19,
          },
        ],
      }),
    );
    expect(result).toEqual({
      purchaseId: 321,
      accessKey,
      total: 15.95,
      itemCount: 1,
    });
  });

  it('deriva preco unitario do total da linha quando unityPrice nao vem no payload', async () => {
    mockRpc.mockResolvedValue({
      data: [{ purchase_id: 654 }],
      error: null,
    });

    await nfceService.createPurchaseFromScrapedData(
      {
        storeName: 'Mercearia Exemplo',
        total: 15.95,
        items: [
          {
            name: 'CERVEJA PROIBIDA 473ML PILSEN (Código: 1570 )',
            quantity: 5,
            unit: 'UN',
            totalPrice: 15.95,
          },
        ],
      },
      '43180611111111111111111111111111111111111111',
      99,
    );

    expect(mockRpc).toHaveBeenCalledWith(
      'create_purchase_with_items',
      expect.objectContaining({
        p_total_price: 15.95,
        p_items: [
          expect.objectContaining({ price: 3.19 }),
        ],
      })
    );
  });
});
