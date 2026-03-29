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

  it('calcula preco medio do item com base na quantidade total comprada', async () => {
    // Nova query otimizada com JOIN - mock para tabela 'items'
    const itemsResponse = Promise.resolve({
      data: [
        { 
          quantity: 5, 
          price: 3.19, 
          purchase_id: 10,
          purchases: { supermarket: { name: 'Mercado A' } }
        }
      ],
      error: null,
    }) as Promise<{ data: Array<{ quantity: number; price: number; purchase_id: number; purchases: { supermarket: { name: string } } }>; error: null }> & {
      select: jest.Mock;
      eq: jest.Mock;
      gte: jest.Mock;
      lte: jest.Mock;
    };
    itemsResponse.select = jest.fn(() => itemsResponse);
    itemsResponse.eq = jest.fn(() => itemsResponse);
    itemsResponse.gte = jest.fn(() => itemsResponse);
    itemsResponse.lte = jest.fn(() => itemsResponse);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return itemsResponse;
      }
      // Fallback para purchases (não usado na nova implementação)
      return Promise.resolve({ data: [], error: null });
    });

    const result = await reportService.getItemReport('Cerveja', '2026-03-01', '2026-03-31');

    expect(result).toEqual({
      totalQuantity: 5,
      totalSpent: 15.95,
      averagePrice: 3.19,
      purchaseCount: 1,
      bySupermarket: [
        {
          supermarket: 'Mercado A',
          totalQuantity: 5,
          totalSpent: 15.95,
          averagePrice: 3.19,
        },
      ],
    });
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
    // Mock da query otimizada de items com join
    const itemsResponse = Promise.resolve({
      data: [
        { quantity: 1, price: 10, purchase_id: 10, purchases: { date: '2024-01-01' } },
        { quantity: 1, price: 14, purchase_id: 11, purchases: { date: '2024-01-31' } },
      ],
      error: null,
    }) as Promise<{ data: Array<{ quantity: number; price: number; purchase_id: number; purchases: { date: string } }>; error: null }> & {
      select: jest.Mock;
      eq: jest.Mock;
      gte: jest.Mock;
      lte: jest.Mock;
    };
    itemsResponse.select = jest.fn(() => itemsResponse);
    itemsResponse.eq = jest.fn(() => itemsResponse);
    itemsResponse.gte = jest.fn(() => itemsResponse);
    itemsResponse.lte = jest.fn(() => itemsResponse);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'items') {
        return itemsResponse;
      }
      return Promise.resolve({ data: [], error: null });
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

  describe('getUserSavings', () => {
    it('calcula economia quando preco atual e menor que media historica', async () => {
      // Dados de teste organizados por tipo
      const testData = {
        currentPurchases: { data: [{ id: 1 }, { id: 2 }], error: null },
        currentItems: {
          data: [
            { name: 'Arroz', price: '8.00', quantity: '2', purchase_id: 1 },
            { name: 'Feijao', price: '10.00', quantity: '1', purchase_id: 2 },
          ],
          error: null,
        },
        historicalPurchases: { data: [{ id: 10 }, { id: 11 }], error: null },
        historicalItems: {
          data: [
            { name: 'Arroz', price: '10.00' },
            { name: 'Arroz', price: '10.00' },
            { name: 'Arroz', price: '10.00' },
            { name: 'Feijao', price: '12.00' },
            { name: 'Feijao', price: '12.00' },
            { name: 'Feijao', price: '12.00' },
          ],
          error: null,
        },
      };

      // Estado do mock para rastrear chamadas
      const mockState = {
        purchasesCalls: 0,
        itemsCalls: 0,
      };

      mockFrom.mockImplementation((table: string) => {
        const baseMock = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
        };

        if (table === 'purchases') {
          mockState.purchasesCalls++;
          // Primeira chamada (gte): período atual, segunda (lt): histórico
          if (mockState.purchasesCalls === 1) {
            return { ...baseMock, ...testData.currentPurchases };
          }
          return { ...baseMock, ...testData.historicalPurchases };
        }

        if (table === 'items') {
          mockState.itemsCalls++;
          // Primeira chamada: items atuais, segunda: items históricos
          if (mockState.itemsCalls === 1) {
            return { ...baseMock, ...testData.currentItems };
          }
          return { ...baseMock, ...testData.historicalItems };
        }

        return baseMock;
      });

      const result = await reportService.getUserSavings(1, 2024);

      // Arroz: (10 - 8) * 2 = 4.00 de economia
      // Feijao: (12 - 10) * 1 = 2.00 de economia
      // Total: 6.00
      expect(result).toBe(6);
    });

    it('retorna 0 quando nao ha compras no periodo', async () => {
      const emptyResponse = {
        data: [],
        error: null,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      };

      mockFrom.mockImplementation(() => emptyResponse);

      const result = await reportService.getUserSavings(1, 2024);

      expect(result).toBe(0);
    });

    it('retorna 0 quando preco atual e maior que media (sem economia negativa)', async () => {
      const currentPurchasesResponse = {
        data: [{ id: 1 }],
        error: null,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      };

      // Preço atual = 15, maior que média histórica de 10
      const currentItemsResponse = {
        data: [{ name: 'Arroz', price: '15.00', quantity: '1', purchase_id: 1 }],
        error: null,
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      const historicalPurchasesResponse = {
        data: [{ id: 10 }, { id: 11 }],
        error: null,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
      };

      const historicalItemsResponse = {
        data: [
          { name: 'Arroz', price: '10.00' },
          { name: 'Arroz', price: '10.00' },
        ],
        error: null,
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'purchases') {
          if (callCount === 1) {
            return currentPurchasesResponse;
          }
          return historicalPurchasesResponse;
        }
        if (callCount === 2) {
          return currentItemsResponse;
        }
        return historicalItemsResponse;
      });

      const result = await reportService.getUserSavings(1, 2024);

      // Não deve mostrar economia negativa
      expect(result).toBe(0);
    });

    it('retorna 0 quando nao ha historico suficiente (menos de 3 compras)', async () => {
      const currentPurchasesResponse = {
        data: [{ id: 1 }],
        error: null,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      };

      const currentItemsResponse = {
        data: [{ name: 'Arroz', price: '8.00', quantity: '1', purchase_id: 1 }],
        error: null,
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      const historicalPurchasesResponse = {
        data: [{ id: 10 }, { id: 11 }],
        error: null,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
      };

      // Apenas 2 compras históricas (precisa de pelo menos 3)
      const historicalItemsResponse = {
        data: [
          { name: 'Arroz', price: '10.00' },
          { name: 'Arroz', price: '10.00' },
        ],
        error: null,
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
      };

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'purchases') {
          if (callCount === 1) {
            return currentPurchasesResponse;
          }
          return historicalPurchasesResponse;
        }
        if (callCount === 2) {
          return currentItemsResponse;
        }
        return historicalItemsResponse;
      });

      const result = await reportService.getUserSavings(1, 2024);

      expect(result).toBe(0);
    });
  });
});
