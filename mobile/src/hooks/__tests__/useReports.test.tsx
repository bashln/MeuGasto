import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useReports } from '../useReports';
import { getPeriodRange } from '../../features/reports/utils/periodUtils';
import { reportService } from '../../services';

jest.mock('../../services', () => ({
  reportService: {
    getMonthlyExpenses: jest.fn(),
    getTopItems: jest.fn(),
    getMarketRanking: jest.fn(),
    getItemReport: jest.fn(),
    getItemPriceHistory: jest.fn(),
  },
}));

const mockedReportService = reportService as jest.Mocked<typeof reportService>;

const emptyItemReport = {
  totalQuantity: 0,
  totalSpent: 0,
  averagePrice: 0,
  purchaseCount: 0,
  bySupermarket: [],
};

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useReports', () => {
  let hookResult: ReturnType<typeof useReports> | null = null;

  const Harness = () => {
    hookResult = useReports();
    return null;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedReportService.getMonthlyExpenses.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: 0 })),
    );
    mockedReportService.getTopItems.mockResolvedValue([]);
    mockedReportService.getMarketRanking.mockResolvedValue([]);
    mockedReportService.getItemReport.mockResolvedValue(emptyItemReport);
    mockedReportService.getItemPriceHistory.mockResolvedValue([]);
  });

  it('usa periodo selecionado para carregar top itens', async () => {
    await act(async () => {
      TestRenderer.create(<Harness />);
    });
    await flushAsync();

    const selectedYear = hookResult!.selectedYear;
    const referenceDate =
      selectedYear === new Date().getFullYear() ? new Date() : new Date(selectedYear, 11, 31);

    const initialRange = getPeriodRange('6months', referenceDate);
    expect(mockedReportService.getTopItems).toHaveBeenCalledWith(
      50,
      initialRange.startDate,
      initialRange.endDate,
    );

    act(() => {
      hookResult!.setSelectedPeriod('3months');
    });
    await flushAsync();

    const updatedRange = getPeriodRange('3months', referenceDate);
    const lastTopItemsCall = mockedReportService.getTopItems.mock.calls.at(-1);

    expect(lastTopItemsCall).toEqual([50, updatedRange.startDate, updatedRange.endDate]);
  });

  it('carrega relatorio do item usando intervalo do periodo', async () => {
    await act(async () => {
      TestRenderer.create(<Harness />);
    });
    await flushAsync();

    const selectedYear = hookResult!.selectedYear;
    const referenceDate =
      selectedYear === new Date().getFullYear() ? new Date() : new Date(selectedYear, 11, 31);
    const periodRange = getPeriodRange('6months', referenceDate);

    act(() => {
      hookResult!.setSelectedItem('Arroz');
    });
    await flushAsync();

    expect(mockedReportService.getItemReport).toHaveBeenCalledWith(
      'Arroz',
      periodRange.startDate,
      periodRange.endDate,
    );
    expect(mockedReportService.getItemPriceHistory).toHaveBeenCalledWith(
      'Arroz',
      periodRange.startDate,
      periodRange.endDate,
    );
  });

  it('usa intervalo real do periodo na aba geral', async () => {
    await act(async () => {
      TestRenderer.create(<Harness />);
    });
    await flushAsync();

    const selectedYear = hookResult!.selectedYear;
    const referenceDate =
      selectedYear === new Date().getFullYear() ? new Date() : new Date(selectedYear, 11, 31);
    const periodRange = getPeriodRange('6months', referenceDate);

    act(() => {
      hookResult!.setReportType('geral');
    });
    await flushAsync();

    const monthlyCall = mockedReportService.getMonthlyExpenses.mock.calls.at(-1);
    expect(monthlyCall).toEqual([periodRange.startDate, periodRange.endDate]);
  });
});
