import { draftService } from '../draftService';
import { serializeContent } from '../draftContent';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../lib/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../authService', () => ({
  authService: { getSession: jest.fn().mockResolvedValue({ user: { id: 'user-123' } }) },
  getCurrentUserId: jest.fn().mockResolvedValue('user-123'),
}));
jest.mock('../purchaseService', () => ({
  purchaseService: {
    createManualPurchase: jest.fn().mockResolvedValue({ id: 99, products: [] }),
  },
}));

import { supabase } from '../../lib/supabaseClient';
import { purchaseService } from '../purchaseService';

// Builder de cadeia Supabase reutilizável
const makeMockChain = (overrides: Record<string, jest.Mock> = {}) => {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  // Cada método retorna o próprio objeto (cadeia fluente)
  Object.keys(chain).forEach(key => {
    if (key !== 'single' && !overrides[key]) {
      chain[key].mockReturnValue(chain);
    }
  });
  return chain;
};

const RAW_DRAFT = {
  id: 1,
  content: serializeContent('Compra de quinta', [
    { name: 'Leite', quantity: 2, unit: 'l', price: 3.5 },
  ]),
  total_price: '7.00',
  supermarket: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

// ── getDraftById ──────────────────────────────────────────────────────────────

describe('draftService.getDraftById', () => {
  it('retorna rascunho com items e notas parseados do JSON', async () => {
    const chain = makeMockChain({
      single: jest.fn().mockResolvedValue({ data: RAW_DRAFT, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await draftService.getDraftById(1);

    expect(result.content).toBe('Compra de quinta');
    expect(result.items).toEqual([{ name: 'Leite', quantity: 2, unit: 'l', price: 3.5 }]);
    expect(result.totalPrice).toBe(7);
  });

  it('faz fallback para texto puro (rascunhos antigos sem JSON)', async () => {
    const oldDraft = { ...RAW_DRAFT, content: 'texto livre antigo' };
    const chain = makeMockChain({
      single: jest.fn().mockResolvedValue({ data: oldDraft, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await draftService.getDraftById(1);

    expect(result.content).toBe('texto livre antigo');
    expect(result.items).toEqual([]);
  });

  it('lança erro quando Supabase retorna erro', async () => {
    const chain = makeMockChain({
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(draftService.getDraftById(1)).rejects.toThrow('Not found');
  });
});

// ── createDraft ───────────────────────────────────────────────────────────────

describe('draftService.createDraft', () => {
  it('salva content como JSON com notas e items', async () => {
    const items = [{ name: 'Arroz', quantity: 5, unit: 'kg', price: 4.0 }];
    const insertedDraft = {
      ...RAW_DRAFT,
      id: 2,
      content: serializeContent('Lista', items),
      total_price: '20.00',
    };

    // Primeira chamada (insert): retorna o ID
    // Segunda chamada (getDraftById via select): retorna o draft completo
    const chain = makeMockChain({
      single: jest.fn()
        .mockResolvedValueOnce({ data: { id: 2 }, error: null })
        .mockResolvedValueOnce({ data: insertedDraft, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await draftService.createDraft({ content: 'Lista', items });

    // Verifica que o insert recebeu o JSON correto
    const insertCall = chain.insert.mock.calls[0][0];
    const parsedContent = JSON.parse(insertCall.content);
    expect(parsedContent.notes).toBe('Lista');
    expect(parsedContent.items).toEqual(items);

    // Verifica que o total_price foi calculado corretamente (5 × 4 = 20)
    expect(insertCall.total_price).toBe(20);

    // Verifica o objeto retornado
    expect(result.items).toEqual(items);
  });

  it('calcula total_price somando quantidade × preço de cada item', async () => {
    const items = [
      { name: 'Feijão', quantity: 2, unit: 'kg', price: 6.5 },
      { name: 'Sal', quantity: 1, unit: 'kg', price: 2.0 },
    ];
    // total esperado: (2 × 6.5) + (1 × 2.0) = 15

    const chain = makeMockChain({
      single: jest.fn()
        .mockResolvedValueOnce({ data: { id: 3 }, error: null })
        .mockResolvedValueOnce({ data: { ...RAW_DRAFT, id: 3, content: serializeContent('', items), total_price: '15' }, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await draftService.createDraft({ content: '', items });

    const insertCall = chain.insert.mock.calls[0][0];
    expect(insertCall.total_price).toBe(15);
  });

  it('salva total_price zero quando não há items', async () => {
    const chain = makeMockChain({
      single: jest.fn()
        .mockResolvedValueOnce({ data: { id: 4 }, error: null })
        .mockResolvedValueOnce({ data: { ...RAW_DRAFT, id: 4, content: serializeContent('sem itens', []), total_price: '0' }, error: null }),
    });
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await draftService.createDraft({ content: 'sem itens', items: [] });

    const insertCall = chain.insert.mock.calls[0][0];
    expect(insertCall.total_price).toBe(0);
  });
});

// ── convertDraftToPurchase ────────────────────────────────────────────────────

describe('draftService.convertDraftToPurchase', () => {
  const DRAFT_WITH_ITEMS = {
    id: 1,
    content: 'Compra de quinta',
    items: [
      { name: 'Leite', quantity: 2, unit: 'l', price: 3.5 },
      { name: 'Pão', quantity: 1, unit: 'un', price: 5.0 },
    ],
    totalPrice: 12,
    supermarket: undefined,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  it('chama createManualPurchase com os items do rascunho', async () => {
    jest.spyOn(draftService, 'getDraftById').mockResolvedValue(DRAFT_WITH_ITEMS);
    jest.spyOn(draftService, 'deleteDraft').mockResolvedValue();

    await draftService.convertDraftToPurchase(1);

    expect(purchaseService.createManualPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPrice: 12,
        items: DRAFT_WITH_ITEMS.items,
      })
    );
  });

  it('deleta o rascunho após criar a compra com sucesso', async () => {
    jest.spyOn(draftService, 'getDraftById').mockResolvedValue(DRAFT_WITH_ITEMS);
    const deleteSpy = jest.spyOn(draftService, 'deleteDraft').mockResolvedValue();

    await draftService.convertDraftToPurchase(1);

    expect(deleteSpy).toHaveBeenCalledWith(1);
  });

  it('passa a data de hoje para createManualPurchase', async () => {
    jest.spyOn(draftService, 'getDraftById').mockResolvedValue(DRAFT_WITH_ITEMS);
    jest.spyOn(draftService, 'deleteDraft').mockResolvedValue();

    await draftService.convertDraftToPurchase(1);

    const today = new Date().toISOString().split('T')[0];
    expect(purchaseService.createManualPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ date: today })
    );
  });

  it('não deleta o rascunho se createManualPurchase falhar', async () => {
    jest.spyOn(draftService, 'getDraftById').mockResolvedValue(DRAFT_WITH_ITEMS);
    const deleteSpy = jest.spyOn(draftService, 'deleteDraft').mockResolvedValue();
    (purchaseService.createManualPurchase as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    await expect(draftService.convertDraftToPurchase(1)).rejects.toThrow('DB error');
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
