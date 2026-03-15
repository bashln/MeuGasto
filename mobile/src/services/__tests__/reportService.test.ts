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

  it('agrupa historico de preco por mes sem deslocamento de timezone', async () => {
    const purchasesResponse = Promise.resolve({
      data: [
        { id: 10, date: '2024-01-01' },
        { id: 11, date: '2024-01-31' },
      ],
      error: null,
    }) as Promise<{ data: Array<{ id: number; date: string }>; error: null }> & {
      select: jest.Mock;
      eq: jest.Mock;
      gte: jest.Mock;
      lte: jest.Mock;
    };
    purchasesResponse.select = jest.fn(() => purchasesResponse);
    purchasesResponse.eq = jest.fn(() => purchasesResponse);
    purchasesResponse.gte = jest.fn(() => purchasesResponse);
    purchasesResponse.lte = jest.fn(() => purchasesResponse);

    const itemsResponse = Promise.resolve({
      data: [
        { purchase_id: 10, quantity: 1, price: 10 },
        { purchase_id: 11, quantity: 1, price: 14 },
      ],
      error: null,
    }) as Promise<{ data: Array<{ purchase_id: number; quantity: number; price: number }>; error: null }> & {
      select: jest.Mock;
      eq: jest.Mock;
      in: jest.Mock;
    };
    itemsResponse.select = jest.fn(() => itemsResponse);
    itemsResponse.eq = jest.fn(() => itemsResponse);
    itemsResponse.in = jest.fn(() => itemsResponse);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'purchases') {
        return purchasesResponse;
      }
      return itemsResponse;
    });

    const result = await reportService.getItemPriceHistory('Arroz', '2024-01-01', '2024-01-31');

    expect(result).toEqual([
      {
        month: 1,
        year: 2024,
        averagePrice: 12,
      },
    ]);
  });
});
