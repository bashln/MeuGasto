jest.mock('../../lib/supabaseClient', () => {
  const mockClient = { from: jest.fn(), rpc: jest.fn() };
  return {
    supabase: mockClient,
    getSupabaseClient: jest.fn().mockReturnValue(mockClient),
    isSupabaseConfigured: jest.fn().mockReturnValue(true),
  };
});

jest.mock('../authService', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('user-1'),
}));


import { purchaseService } from '../purchaseService';
import { supabase } from '../../lib/supabaseClient';

const mockFrom = supabase!.from as jest.Mock;
const mockRpc = supabase!.rpc as jest.Mock;

const makeChain = (result: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockResolvedValue(result),
  single: jest.fn().mockResolvedValue(result),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
});

describe('purchaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mapeia compras e pagina corretamente em getPurchases', async () => {
    const chain = makeChain({
      data: [
        {
          id: 10,
          supermarket: { id: 1, name: 'Mercado' },
          access_key: null,
          date: '2026-02-01',
          total_price: '15.50',
          manual: true,
          items: [{ id: 1, name: 'Leite', quantity: '2', unit: 'UN', price: '4.5' }],
          created_at: '2026-02-01T00:00:00.000Z',
          updated_at: '2026-02-01T00:00:00.000Z',
        },
      ],
      error: null,
      count: 1,
    });
    mockFrom.mockReturnValue(chain);

    const result = await purchaseService.getPurchases({ page: 0, size: 20 });

    expect(result.data[0].totalPrice).toBe(15.5);
    expect(result.data[0].products[0].quantity).toBe(2);
    expect(result.page.totalPages).toBe(1);
  });

  it('lanca erro quando RPC nao retorna purchase_id', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(
      purchaseService.createManualPurchase({
        date: '2026-02-02',
        totalPrice: 10,
        items: [{ name: 'Cafe', quantity: 1, unit: 'UN', price: 10 }],
      })
    ).rejects.toThrow(/N[aã]o foi poss[ií]vel criar a compra manual/i);
  });

  it('inclui category_id nos itens ao criar compra manual', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await expect(
      purchaseService.createManualPurchase({
        date: '2026-02-02',
        totalPrice: 20,
        items: [{ name: 'Detergente Neutro', quantity: 1, unit: 'UN', price: 5 }],
      })
    ).rejects.toThrow();

    expect(mockRpc).toHaveBeenCalledWith(
      'create_purchase_with_items',
      expect.objectContaining({
        p_items: [
          expect.objectContaining({
            name: 'Detergente Neutro',
            category_id: expect.any(Number),
          }),
        ],
      })
    );
  });

  it('persiste reclassificacao e dispara aprendizado no categorizador', async () => {
    const chain = makeChain({ error: null });
    const updateChain = {
      ...chain,
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(updateChain);

    await purchaseService.reclassifyPurchaseItem(77, 'Detergente Neutro', 1);

    expect(mockFrom).toHaveBeenCalledWith('items');
    expect(updateChain.update).toHaveBeenCalledWith({ category_id: 1 });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 77);
  });
});
