jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const mockUseDashboard = jest.fn();

jest.mock('../../hooks/useDashboard', () => ({
  useDashboard: () => mockUseDashboard(),
}));

let monthPickerProps: { onChange: (value: { month: number; year: number }) => void } | null = null;

jest.mock('../../components', () => ({
  Header: () => null,
  ErrorMessage: ({ message }: { message: string }) => message,
  MonthYearPicker: (props: { onChange: (value: { month: number; year: number }) => void }) => {
    monthPickerProps = props;
    return null;
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DashboardScreen } from '../DashboardScreen';

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    monthPickerProps = null;
    mockUseDashboard.mockReturnValue({
      stats: { totalSpent: 100, purchaseCount: 2, itemCount: 3, savings: 5 },
      topItems: [{ name: 'Arroz', quantity: 1, total: 20 }],
      supermarketData: [{ supermarket: 'Mercado A', total: 80 }],
      monthlyTotals: [{ month: 1, total: 100 }],
      previousYearMonthlyTotals: [{ month: 12, total: 50 }],
      selectedMonth: 1,
      selectedYear: 2026,
      setSelectedMonth: jest.fn(),
      setSelectedYear: jest.fn(),
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    });
  });

  it('renderiza insights e navega nas ações rápidas', () => {
    const navigate = jest.fn();
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(<DashboardScreen navigation={{ navigate } as never} />);
    });

    expect(renderer!.root.findByProps({ children: 'Insights deste mês' })).toBeTruthy();

    const addPurchaseText = renderer!.root.findByProps({ children: '+ Adicionar' });
    let current = addPurchaseText.parent;
    while (current && typeof current.props?.onPress !== 'function') {
      current = current.parent;
    }

    act(() => {
      current!.props.onPress();
    });

    expect(navigate).toHaveBeenCalled();
  });

  it('atualiza mês/ano via MonthYearPicker', () => {
    const setSelectedMonth = jest.fn();
    const setSelectedYear = jest.fn();

    mockUseDashboard.mockReturnValueOnce({
      ...mockUseDashboard(),
      setSelectedMonth,
      setSelectedYear,
    });

    act(() => {
      TestRenderer.create(<DashboardScreen navigation={{ navigate: jest.fn() } as never} />);
    });

    act(() => {
      monthPickerProps!.onChange({ month: 3, year: 2025 });
    });

    expect(setSelectedMonth).toHaveBeenCalledWith(3);
    expect(setSelectedYear).toHaveBeenCalledWith(2025);
  });
});
