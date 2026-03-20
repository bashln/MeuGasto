jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../components', () => ({
  Header: () => null,
  Loading: () => null,
  ErrorMessage: () => null,
}));

jest.mock('../../features/reports/components/InsightsBlock', () => ({
  InsightsBlock: () => null,
}));

jest.mock('../../features/reports/components/PriceHistoryChart', () => ({
  PriceHistoryChart: () => null,
}));

jest.mock('../../features/reports/components/MarketRanking', () => ({
  MarketRanking: () => null,
}));

if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
  (window as Window & { dispatchEvent: (...args: unknown[]) => void }).dispatchEvent = jest.fn();
}

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import { ReportsScreen } from '../ReportsScreen';
import { useReportsScreenModel } from '../../features/reports';

jest.mock('../../features/reports', () => {
  const actual = jest.requireActual('../../features/reports');
  return {
    ...actual,
    useReportsScreenModel: jest.fn(),
  };
});

const mockedUseReportsScreenModel = useReportsScreenModel as jest.MockedFunction<typeof useReportsScreenModel>;

const buildUseReportsMock = (
  overrides: Partial<ReturnType<typeof useReportsScreenModel>> = {},
): ReturnType<typeof useReportsScreenModel> => ({
  isLoading: false,
  error: null,
  reportType: 'geral',
  selectedYear: 2026,
  selectedPeriod: '6months',
  selectedItem: '',
  monthlyData: [],
  supermarketData: [],
  topItems: [],
  itemReport: null,
  itemPriceHistory: [],
  setReportType: jest.fn(),
  setSelectedYear: jest.fn(),
  setSelectedPeriod: jest.fn(),
  setSelectedItem: jest.fn(),
  loadReport: jest.fn(async () => {}),
  loadItemReport: jest.fn(async () => {}),
  refresh: jest.fn(async () => {}),
  itemReportData: {
    totalQuantity: 0,
    totalSpent: 0,
    averagePrice: 0,
    purchaseCount: 0,
    bySupermarket: [],
  },
  insights: [],
  insightsLoading: false,
  handleExportCSV: jest.fn(async () => {}),
  ...overrides,
});

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mostra estado vazio util no relatorio geral', () => {
    mockedUseReportsScreenModel.mockReturnValue(buildUseReportsMock({ reportType: 'geral' }));

    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(<ReportsScreen />);
    });

    expect(renderer!.root.findByProps({ children: 'Nenhum dado disponivel' })).toBeTruthy();
    expect(
      renderer!.root.findByProps({
        children: 'Nao ha gastos registrados no periodo selecionado. Tente ampliar o periodo de analise.',
      }),
    ).toBeTruthy();
  });

  it('integra PeriodFilter com setSelectedPeriod', () => {
    const setSelectedPeriod = jest.fn();
    mockedUseReportsScreenModel.mockReturnValue(
      buildUseReportsMock({
        reportType: 'itens',
        setSelectedPeriod,
        topItems: [{ name: 'Arroz', quantity: 1, total: 10, percentage: 100 }],
      }),
    );

    let renderer: ReturnType<typeof TestRenderer.create>;
    act(() => {
      renderer = TestRenderer.create(<ReportsScreen />);
    });
    const touchables = renderer!.root.findAllByType(TouchableOpacity);
    const periodButton = touchables.find(
      (touchable: { findAllByProps: (props: { children: string }) => unknown[] }) =>
        touchable.findAllByProps({ children: '12M' }).length > 0,
    );

    expect(periodButton).toBeTruthy();

    act(() => {
      periodButton!.props.onPress();
    });

    expect(setSelectedPeriod).toHaveBeenCalledWith('12months');
  });
});
