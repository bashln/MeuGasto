jest.mock('../../services', () => ({
  reportService: {
    getMonthlyExpenses: jest.fn(),
    getTopItems: jest.fn(),
    getExpensesBySupermarket: jest.fn(),
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

describe('useReports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReportService.getMonthlyExpenses.mockResolvedValue([{ month: 1, total: 300 }]);
    mockReportService.getTopItems.mockResolvedValue([{ name: 'Feijão', quantity: 2, total: 30 }]);
    mockReportService.getExpensesBySupermarket.mockResolvedValue([{ supermarket: 'Mercado A', total: 300 }]);
    mockReportService.getItemReport.mockResolvedValue({
      totalQuantity: 3,
      totalSpent: 45,
      averagePrice: 15,
      purchaseCount: 2,
      bySupermarket: [],
    });
  });

  it('carrega relatório padrão de itens e define item selecionado', async () => {
    const snapshots: HookState[] = [];

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => snapshots.push(value)} />);
    });

    const last = snapshots[snapshots.length - 1];
    expect(last.topItems).toHaveLength(1);
    expect(last.selectedItem).toBe('Feijão');
    expect(mockReportService.getTopItems).toHaveBeenCalled();
  });

  it('carrega relatório geral quando tipo for geral', async () => {
    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => { latest = value; }} />);
    });

    await act(async () => {
      latest!.setReportType('geral');
    });

    await act(async () => {
      await latest!.loadReport();
    });

    expect(mockReportService.getMonthlyExpenses).toHaveBeenCalled();
  });

  it('faz refresh e carrega item report quando item selecionado existe', async () => {
    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => { latest = value; }} />);
    });

    await act(async () => {
      latest!.setSelectedItem('Feijão');
    });

    await act(async () => {
      await latest!.refresh();
    });

    expect(mockReportService.getItemReport).toHaveBeenCalledWith('Feijão', expect.any(String), expect.any(String));
  });
});
