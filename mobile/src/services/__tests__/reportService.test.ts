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
import { getCurrentUserId } from '../authService';

const mockFrom = supabase!.from as jest.Mock;
const mockRpc = supabase!.rpc as jest.Mock;
const mockGetCurrentUserId = getCurrentUserId as jest.Mock;

describe('reportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUserId.mockResolvedValue('user-1');
  });

  it('converte totais retornados do RPC de supermercado', async () => {
    mockRpc.mockResolvedValue({
      data: [{ supermarket: 'Mercado A', total: '33.7' }],
      error: null,
    });

    const result = await reportService.getExpensesBySupermarket();

    expect(result).toEqual([{ supermarket: 'Mercado A', total: 33.7 }]);
  });

  it('usa janeiro quando month=0 ao montar range de dashboard', async () => {
    const purchaseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    mockFrom.mockReturnValueOnce(purchaseQuery);

    await reportService.getDashboardStats(0, 2026);

    expect(purchaseQuery.gte).toHaveBeenCalledWith('date', '2026-01-01');
    expect(purchaseQuery.lte).toHaveBeenCalledWith('date', '2026-01-31');
  });

  it('agrega dashboard com compras e itens', async () => {
    const purchaseQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          { id: 1, total_price: '10.5' },
          { id: 2, total_price: '4.5' },
        ],
        error: null,
      }),
    };
    const itemsQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ quantity: '2' }, { quantity: '3' }],
        error: null,
      }),
    };

    mockFrom
      .mockReturnValueOnce(purchaseQuery)
      .mockReturnValueOnce(itemsQuery);

    const result = await reportService.getDashboardStats(5, 2026);

    expect(result).toEqual({
      totalSpent: 15,
      purchaseCount: 2,
      itemCount: 5,
      savings: 0,
    });
  });

  it('retorna vazio e nao chama RPC quando nao ha userId', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    const result = await reportService.getExpensesBySupermarket();

    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
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

  it('consolida gastos mensais por ano', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [
          { date: '2026-01-12T12:00:00Z', total_price: '10' },
          { date: '2026-01-20T12:00:00Z', total_price: '5' },
          { date: '2026-02-01T12:00:00Z', total_price: '3.5' },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(query);

    const result = await reportService.getMonthlyExpenses(2026);

    expect(result.find((r) => r.month === 1)).toEqual({ month: 1, total: 15 });
    expect(result.find((r) => r.month === 2)).toEqual({ month: 2, total: 3.5 });
    expect(result).toHaveLength(12);
  });

  it('retorna top itens convertendo quantity e total para number', async () => {
    mockRpc.mockResolvedValue({
      data: [{ name: 'Arroz', quantity: '2', total: '13.4' }],
      error: null,
    });

    const result = await reportService.getTopItems(5, '2026-01-01', '2026-01-31');

    expect(mockRpc).toHaveBeenCalledWith('report_top_items', {
      p_limit: 5,
      p_start_date: '2026-01-01',
      p_end_date: '2026-01-31',
    });
    expect(result).toEqual([{ name: 'Arroz', quantity: 2, total: 13.4 }]);
  });

  it('retorna o mesmo relatorio para ARROZ e arroz com match case-insensitive', async () => {
    const createPurchaseQuery = () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [{ id: 1, supermarket: { name: 'Mercado A' } }],
        error: null,
      }),
    });

    const createItemsQuery = () => ({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockResolvedValue({
        data: [{ purchase_id: 1, name: 'arroz', quantity: '2', price: '5' }],
        error: null,
      }),
    });

    const itemsQueryUpper = createItemsQuery();
    const itemsQueryLower = createItemsQuery();

    mockFrom
      .mockReturnValueOnce(createPurchaseQuery())
      .mockReturnValueOnce(itemsQueryUpper)
      .mockReturnValueOnce(createPurchaseQuery())
      .mockReturnValueOnce(itemsQueryLower);

    const upperResult = await reportService.getItemReport('ARROZ', '2026-01-01', '2026-12-31');
    const lowerResult = await reportService.getItemReport('arroz', '2026-01-01', '2026-12-31');

    expect(itemsQueryUpper.ilike).toHaveBeenCalledWith('name', 'ARROZ');
    expect(itemsQueryLower.ilike).toHaveBeenCalledWith('name', 'arroz');
    expect(upperResult).toEqual(lowerResult);
    expect(upperResult).toEqual({
      totalQuantity: 2,
      totalSpent: 10,
      averagePrice: 5,
      purchaseCount: 1,
      bySupermarket: [
        {
          supermarket: 'Mercado A',
          totalQuantity: 2,
          totalSpent: 10,
          averagePrice: 5,
        },
      ],
    });
  });
});
