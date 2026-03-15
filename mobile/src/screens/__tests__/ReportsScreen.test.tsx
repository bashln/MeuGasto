jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../components', () => ({
  Header: () => null,
  Loading: () => null,
  ErrorMessage: () => null,
}));

jest.mock('../../features/reports/hooks/useReportInsights', () => ({
  useReportInsights: () => ({ insights: [], loading: false }),
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
import { useReports } from '../../hooks/useReports';

jest.mock('../../hooks/useReports', () => ({
  useReports: jest.fn(),
}));

const mockedUseReports = useReports as jest.MockedFunction<typeof useReports>;

const buildUseReportsMock = (overrides: Partial<ReturnType<typeof useReports>> = {}): ReturnType<typeof useReports> => ({
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
  ...overrides,
});

describe('ReportsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mostra estado vazio util no relatorio geral', () => {
    mockedUseReports.mockReturnValue(buildUseReportsMock({ reportType: 'geral' }));

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
    mockedUseReports.mockReturnValue(
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
