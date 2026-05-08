jest.mock('../../services', () => ({
  reportService: {
    getDashboardStats: jest.fn(),
    getMonthlyExpenses: jest.fn(),
    getTopItems: jest.fn(),
    getExpensesBySupermarket: jest.fn(),
    getExpensesByCategory: jest.fn(),
    getItemReport: jest.fn(),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useReports } from '../useReports';
import { reportService } from '../../services';

const mockReportService = reportService as jest.Mocked<typeof reportService>;

type HookState = ReturnType<typeof useReports>;

const HookHarness = ({ onRender }: { onRender: (value: HookState) => void }) => {
  const state = useReports();
  onRender(state);
  return null;
};

const defaultMocks = () => {
  mockReportService.getDashboardStats.mockResolvedValue({
    totalSpent: 500,
    purchaseCount: 3,
    itemCount: 10,
    savings: 0,
  });
  mockReportService.getMonthlyExpenses.mockResolvedValue([{ month: 1, total: 300 }]);
  mockReportService.getTopItems.mockResolvedValue([{ name: 'Feijão', quantity: 2, total: 30 }]);
  mockReportService.getExpensesBySupermarket.mockResolvedValue([{ supermarket: 'Mercado A', total: 300 }]);
  mockReportService.getExpensesByCategory.mockResolvedValue([
    { categoryId: 1, category: 'Alimentação', total: 300, percentage: 100 },
  ]);
  mockReportService.getItemReport.mockResolvedValue({
    totalQuantity: 3,
    totalSpent: 45,
    averagePrice: 15,
    purchaseCount: 2,
    bySupermarket: [],
  });
};

describe('useReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultMocks();
  });

  it('inicia em modo mês e carrega dados do mês atual', async () => {
    const snapshots: HookState[] = [];

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={v => snapshots.push(v)} />);
    });

    const last = snapshots[snapshots.length - 1];
    expect(last.periodMode).toBe('month');
    expect(last.heroValue).toBe(500);
    expect(last.topItems).toHaveLength(1);
    expect(last.topItems[0].name).toBe('Feijão');
    expect(mockReportService.getDashboardStats).toHaveBeenCalledTimes(2); // current + prev month
    expect(mockReportService.getExpensesByCategory).toHaveBeenCalledTimes(2);
    expect(mockReportService.getTopItems).toHaveBeenCalledTimes(1);
  });

  it('muda para modo ano e recarrega dados anuais', async () => {
    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={v => { latest = v; }} />);
    });

    jest.clearAllMocks();
    defaultMocks();

    await act(async () => {
      latest!.setPeriodMode('year');
    });

    expect(mockReportService.getMonthlyExpenses).toHaveBeenCalledTimes(2); // current year + prev year
    expect(mockReportService.getExpensesByCategory).toHaveBeenCalledTimes(2);
    expect(mockReportService.getDashboardStats).not.toHaveBeenCalled(); // ano usa getMonthlyExpenses
  });

  it('carrega item report quando loadItemReport é chamado', async () => {
    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={v => { latest = v; }} />);
    });

    await act(async () => {
      latest!.setSelectedItem('Feijão');
      await latest!.loadItemReport('Feijão');
    });

    expect(mockReportService.getItemReport).toHaveBeenCalledWith(
      'Feijão',
      expect.stringMatching(/^\d{4}-\d{2}-01$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    const last = latest!;
    expect(last.itemReport).not.toBeNull();
    expect(last.itemReport?.averagePrice).toBe(15);
  });

  it('calcula delta de categoria vs período anterior', async () => {
    mockReportService.getExpensesByCategory
      .mockResolvedValueOnce([{ categoryId: 1, category: 'Alimentação', total: 400, percentage: 100 }])
      .mockResolvedValueOnce([{ categoryId: 1, category: 'Alimentação', total: 200, percentage: 100 }]);

    const snapshots: HookState[] = [];

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={v => snapshots.push(v)} />);
    });

    const last = snapshots[snapshots.length - 1];
    const alim = last.categoryData.find(c => c.categoryId === 1);
    expect(alim).toBeDefined();
    expect(alim!.delta).toBeCloseTo(100); // +100% vs mês anterior
  });

  it('refresh recarrega os dados', async () => {
    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={v => { latest = v; }} />);
    });

    jest.clearAllMocks();
    defaultMocks();

    await act(async () => {
      await latest!.refresh();
    });

    expect(mockReportService.getDashboardStats).toHaveBeenCalled();
  });
});
