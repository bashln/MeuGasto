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

import { reportService } from '../reportService';
import { supabase } from '../../lib/supabaseClient';

const mockFrom = supabase!.from as jest.Mock;
const mockRpc = supabase!.rpc as jest.Mock;

describe('reportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('converte totais retornados do RPC de supermercado', async () => {
    mockRpc.mockResolvedValue({
      data: [{ supermarket: 'Mercado A', total: '33.7' }],
      error: null,
    });

    const result = await reportService.getExpensesBySupermarket();

    expect(result).toEqual([{ supermarket: 'Mercado A', total: 33.7 }]);
  });

  it('retorna relatorio vazio quando itemName nao e informado', async () => {
    const result = await reportService.getItemReport('');

    expect(result).toEqual({
      totalQuantity: 0,
      totalSpent: 0,
      averagePrice: 0,
      purchaseCount: 0,
      bySupermarket: [],
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('agrega gastos por categoria com percentual', async () => {
    const purchaseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [{ id: 10 }, { id: 20 }],
        error: null,
      }),
    };

    const itemsQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          { category_id: 1, quantity: '2', price: '5' },
          { category_id: 2, quantity: '1', price: '10' },
        ],
        error: null,
      }),
    };

    mockFrom
      .mockReturnValueOnce(purchaseQuery)
      .mockReturnValueOnce(itemsQuery);

    const result = await reportService.getExpensesByCategory('2026-01-01', '2026-12-31');

    expect(result).toEqual([
      { categoryId: 1, category: 'Alimentação', total: 10, percentage: 50 },
      { categoryId: 2, category: 'Bebidas', total: 10, percentage: 50 },
    ]);
  });
});
