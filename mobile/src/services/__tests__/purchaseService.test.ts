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
  upsert: jest.fn().mockResolvedValue(result),
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

  it('lanca erro quando compra nao e encontrada em getPurchaseById', async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await expect(purchaseService.getPurchaseById(999)).rejects.toThrow('Compra não encontrada');
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
    const updateChain = {
      ...makeChain({ error: null }),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    const persistChain = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    mockFrom
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(persistChain);

    await purchaseService.reclassifyPurchaseItem(77, 'Detergente Neutro', 1);

    expect(mockFrom).toHaveBeenCalledWith('items');
    expect(mockFrom).toHaveBeenCalledWith('learned_reclassifications');
    expect(updateChain.update).toHaveBeenCalledWith({ category_id: 1 });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 77);
    expect(persistChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        normalized_name: 'detergente neutro',
        category_id: 1,
      }),
      { onConflict: 'user_id,normalized_name' }
    );
  });

  it('edita item de compra manual e recalcula total da compra', async () => {
    const purchaseSelectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 10, manual: true }, error: null }),
    };
    const itemUpdateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    const itemsListChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { quantity: 2, price: 5.5 },
          { quantity: 1, price: 3 },
        ],
        error: null,
      }),
    };
    const purchaseUpdateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };

    const fetchByIdChain = makeChain({
      data: {
        id: 10,
        supermarket: { id: 1, name: 'Mercado' },
        access_key: null,
        date: '2026-02-01',
        total_price: '14.00',
        manual: true,
        items: [{ id: 9, name: 'Arroz', quantity: 2, unit: 'UN', price: 5.5 }],
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(purchaseSelectChain)
      .mockReturnValueOnce(itemUpdateChain)
      .mockReturnValueOnce(itemsListChain)
      .mockReturnValueOnce(purchaseUpdateChain)
      .mockReturnValueOnce(fetchByIdChain);

    await purchaseService.editItem(10, 9, {
      name: 'Arroz integral',
      quantity: 2,
      price: 5.5,
    });

    expect(itemUpdateChain.update).toHaveBeenCalledWith({
      name: 'Arroz integral',
      quantity: 2,
      price: 5.5,
    });
    expect(purchaseUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        total_price: 14,
      })
    );
  });

  it('bloqueia edicao de item em compra NFC-e', async () => {
    const purchaseSelectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 12, manual: false }, error: null }),
    };
    mockFrom.mockReturnValueOnce(purchaseSelectChain);

    await expect(
      purchaseService.editItem(12, 1, {
        name: 'Produto',
        quantity: 1,
        price: 1,
      })
    ).rejects.toThrow(/somente leitura/i);
  });

  it('remove item de compra manual e recalcula total da compra', async () => {
    const purchaseSelectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 10, manual: true }, error: null }),
    };
    const itemDeleteChain = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    const itemsListChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [
          { quantity: 1, price: 8 },
          { quantity: 2, price: 3.5 },
        ],
        error: null,
      }),
    };
    const purchaseUpdateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    const fetchByIdChain = makeChain({
      data: {
        id: 10,
        supermarket: { id: 1, name: 'Mercado' },
        access_key: null,
        date: '2026-02-01',
        total_price: '15.00',
        manual: true,
        items: [{ id: 2, name: 'Feijao', quantity: 1, unit: 'UN', price: 8 }],
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(purchaseSelectChain)
      .mockReturnValueOnce(itemDeleteChain)
      .mockReturnValueOnce(itemsListChain)
      .mockReturnValueOnce(purchaseUpdateChain)
      .mockReturnValueOnce(fetchByIdChain);

    await purchaseService.removeItem(10, 9);

    expect(itemDeleteChain.delete).toHaveBeenCalled();
    expect(purchaseUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        total_price: 15,
      })
    );
  });

  it('bloqueia remocao de item em compra NFC-e', async () => {
    const purchaseSelectChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 12, manual: false }, error: null }),
    };
    mockFrom.mockReturnValueOnce(purchaseSelectChain);

    await expect(
      purchaseService.removeItem(12, 1)
    ).rejects.toThrow(/somente leitura/i);
  });
});
