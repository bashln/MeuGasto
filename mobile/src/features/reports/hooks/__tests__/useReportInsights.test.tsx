import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useReportInsights } from '../useReportInsights';
import { reportService } from '../../../../services';

jest.mock('../../../../services', () => ({
  reportService: {
    getExpensesBySupermarket: jest.fn(),
    getItemReport: jest.fn(),
  },
}));

const mockedReportService = reportService as jest.Mocked<typeof reportService>;
const emptyMonthlyData: Array<{ month: number; total: number }> = [];

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useReportInsights', () => {
  let hookResult: ReturnType<typeof useReportInsights> | null = null;

  const Harness = () => {
    hookResult = useReportInsights({
      currentData: emptyMonthlyData,
      period: '6months',
      reportType: 'geral',
      selectedYear: 2025,
    });

    return null;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedReportService.getExpensesBySupermarket.mockResolvedValue([]);
    mockedReportService.getItemReport.mockResolvedValue({
      totalQuantity: 0,
      totalSpent: 0,
      averagePrice: 0,
      purchaseCount: 0,
      bySupermarket: [],
    });
  });

  it('retorna insight neutro quando dados gerais estao vazios', async () => {
    await act(async () => {
      TestRenderer.create(<Harness />);
    });
    await flushAsync();

    expect(hookResult?.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'geral-no-data',
          type: 'neutral',
        }),
      ])
    );
  });
});
