jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-paper', () => ({
  FAB: () => {
    return null;
  },
}));

const mockUsePurchases = jest.fn();

jest.mock('../../context', () => ({
  usePurchases: () => mockUsePurchases(),
}));

jest.mock('../../components', () => ({
  ...(() => {
    const { TouchableOpacity } = jest.requireActual('react-native');
    return {
  Header: () => null,
  Loading: () => null,
  ErrorMessage: ({ message }: { message: string }) => message,
  PurchaseCard: ({ purchase, onPress, onDelete, onEdit }: { purchase: { id: number }; onPress: (p: { id: number }) => void; onDelete: (p: { id: number }) => void; onEdit: (p: { id: number }) => void }) => (
    <>
      <TouchableOpacity testID={`purchase-${purchase.id}`} onPress={() => onPress(purchase)} />
      <TouchableOpacity testID={`delete-${purchase.id}`} onPress={() => onDelete(purchase)} />
      <TouchableOpacity testID={`edit-${purchase.id}`} onPress={() => onEdit(purchase)} />
    </>
  ),
    };
  })(),
}));

import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PurchasesScreen } from '../PurchasesScreen';

const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, bottom: 0, right: 0 } }}>
    {ui}
  </SafeAreaProvider>
);

describe('PurchasesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePurchases.mockReturnValue({
      purchases: [
        {
          id: 1,
          supermarket: { name: 'Mercado A' },
          accessKey: '123',
          totalPrice: 100,
          isManual: false,
        },
      ],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      page: { pageNumber: 0 },
      error: null,
      metrics: { totalCount: 1, totalValue: 100 },
      fetchPurchases: jest.fn().mockResolvedValue(undefined),
      loadMorePurchases: jest.fn().mockResolvedValue(undefined),
      deletePurchase: jest.fn().mockResolvedValue(undefined),
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('busca compras no mount com filtro padrão', async () => {
    const fetchPurchases = jest.fn().mockResolvedValue(undefined);
    mockUsePurchases.mockReturnValueOnce({
      ...mockUsePurchases(),
      fetchPurchases,
    });

    await act(async () => {
      TestRenderer.create(wrap(<PurchasesScreen navigation={{ navigate: jest.fn() } as never} />));
    });

    expect(fetchPurchases).toHaveBeenCalledWith({ page: 0, size: 20, isManual: undefined });
  });

  it('abre alerta ao tentar editar compra importada', () => {
    let renderer: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(wrap(<PurchasesScreen navigation={{ navigate: jest.fn() } as never} />));
    });

    act(() => {
      renderer!.root.findByProps({ testID: 'edit-1' }).props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Compra importada',
      'Compras importadas via NFC-e não podem ser alteradas.'
    );
  });
});
