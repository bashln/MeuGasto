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

const makePurchasesQuery = (data: Record<string, unknown>[], error: unknown = null) => {
  const response = Promise.resolve({ data, error }) as unknown as Record<string, unknown>;
  response['select'] = jest.fn(() => response);
  response['eq'] = jest.fn(() => response);
  response['gte'] = jest.fn(() => response);
  response['lte'] = jest.fn(() => response);
  response['in'] = jest.fn(() => response);
  return response;
};

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

  describe('getMonthlyExpenses', () => {
    it('consulta por ano: retorna 12 meses com totais corretos', async () => {
      mockFrom.mockReturnValue(
        makePurchasesQuery([
          { date: '2024-01-15', total_price: '100.00' },
          { date: '2024-01-20', total_price: '50.00' },
          { date: '2024-03-10', total_price: '200.00' },
        ])
      );

      const result = await reportService.getMonthlyExpenses(2024);

      expect(result).toHaveLength(12);
      const jan = result.find(r => r.month === 1);
      const mar = result.find(r => r.month === 3);
      const feb = result.find(r => r.month === 2);
      expect(jan?.total).toBeCloseTo(150);
      expect(mar?.total).toBeCloseTo(200);
      expect(feb?.total).toBe(0);
    });

    it('consulta por ano: sem compras retorna 12 meses zerados', async () => {
      mockFrom.mockReturnValue(makePurchasesQuery([]));

      const result = await reportService.getMonthlyExpenses(2024);

      expect(result).toHaveLength(12);
      result.forEach(r => expect(r.total).toBe(0));
    });

    it('consulta por periodo no mesmo ano: retorna somente os meses do intervalo', async () => {
      mockFrom.mockReturnValue(
        makePurchasesQuery([
          { date: '2024-03-05', total_price: '80.00' },
          { date: '2024-05-20', total_price: '120.00' },
        ])
      );

      const result = await reportService.getMonthlyExpenses('2024-03-01', '2024-07-31');

      const months = result.map(r => r.month).sort((a, b) => a - b);
      expect(months).toEqual([3, 4, 5, 6, 7]); // mar a jul
      expect(result.find(r => r.month === 3)?.total).toBeCloseTo(80);
      expect(result.find(r => r.month === 5)?.total).toBeCloseTo(120);
      expect(result.find(r => r.month === 4)?.total).toBe(0);
    });

    it('consulta multi-ano: Nov/2024 e Fev/2025 sem colisao de chaves', async () => {
      mockFrom.mockReturnValue(
        makePurchasesQuery([
          { date: '2024-11-10', total_price: '300.00' },
          { date: '2024-12-05', total_price: '150.00' },
          { date: '2025-01-20', total_price: '90.00' },
          { date: '2025-02-14', total_price: '60.00' },
        ])
      );

      const result = await reportService.getMonthlyExpenses('2024-11-01', '2025-02-28');

      // 4 entradas: Nov, Dez, Jan, Fev — sem somar meses de anos diferentes
      expect(result).toHaveLength(4);
      const totals = result.map(r => r.total).sort((a, b) => a - b);
      expect(totals).toEqual([60, 90, 150, 300]);
    });
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
