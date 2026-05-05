jest.mock('../../services', () => ({
  reportService: {
    getDashboardStats: jest.fn(),
    getTopItems: jest.fn(),
    getExpensesBySupermarket: jest.fn(),
    getMonthlyExpenses: jest.fn(),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useDashboard } from '../useDashboard';
import { reportService } from '../../services';

const mockReportService = reportService as jest.Mocked<typeof reportService>;

type HookState = ReturnType<typeof useDashboard>;

const HookHarness = ({ onRender }: { onRender: (value: HookState) => void }) => {
  const state = useDashboard();
  onRender(state);
  return null;
};

describe('useDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReportService.getDashboardStats.mockResolvedValue({ totalSpent: 100, purchaseCount: 2, itemCount: 4, savings: 10 });
    mockReportService.getTopItems.mockResolvedValue([{ name: 'Arroz', quantity: 1, total: 20 }]);
    mockReportService.getExpensesBySupermarket.mockResolvedValue([{ supermarket: 'Mercado A', total: 100 }]);
    mockReportService.getMonthlyExpenses.mockResolvedValue([{ month: 1, total: 100 }]);
  });

  it('carrega dashboard com sucesso', async () => {
    const snapshots: HookState[] = [];

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => snapshots.push(value)} />);
    });

    const last = snapshots[snapshots.length - 1];
    expect(last.isLoading).toBe(false);
    expect(last.error).toBeNull();
    expect(last.stats?.totalSpent).toBe(100);
    expect(last.topItems).toHaveLength(1);
    expect(mockReportService.getDashboardStats).toHaveBeenCalled();
  });

  it('carrega dados do ano anterior quando mes selecionado for janeiro', async () => {
    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => { latest = value; }} />);
    });

    await act(async () => {
      latest!.setSelectedMonth(1);
      latest!.setSelectedYear(2026);
    });

    await act(async () => {
      await latest!.loadDashboard();
    });

    expect(mockReportService.getMonthlyExpenses).toHaveBeenCalledWith(2026);
    expect(mockReportService.getMonthlyExpenses).toHaveBeenCalledWith(2025);
  });

  it('define erro quando serviço falha', async () => {
    mockReportService.getDashboardStats.mockRejectedValueOnce(new Error('falhou dashboard'));
    const snapshots: HookState[] = [];

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => snapshots.push(value)} />);
    });

    const last = snapshots[snapshots.length - 1];
    expect(last.isLoading).toBe(false);
    expect(last.error).toBe('falhou dashboard');
  });
});
