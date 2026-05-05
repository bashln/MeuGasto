jest.mock('../../services', () => ({
  purchaseService: {
    getPurchases: jest.fn(),
    getPurchaseById: jest.fn(),
    updatePurchase: jest.fn(),
    deletePurchase: jest.fn(),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { PurchaseProvider, usePurchases } from '../PurchaseContext';
import { purchaseService } from '../../services';

const mockPurchaseService = purchaseService as jest.Mocked<typeof purchaseService>;

type CtxState = ReturnType<typeof usePurchases>;

const Consumer = ({ onRender }: { onRender: (value: CtxState) => void }) => {
  const value = usePurchases();
  onRender(value);
  return null;
};

describe('PurchaseContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPurchaseService.getPurchases.mockResolvedValue({
      data: [
        { id: 1, supermarket: { id: 1, name: 'A' }, accessKey: '1', date: '2026-01-01', totalPrice: 10, isManual: true, products: [], createdAt: '', updatedAt: '' } as never,
      ],
      page: { pageNumber: 0, pageSize: 20, totalElements: 1, totalPages: 1, last: true },
    });
    mockPurchaseService.getPurchaseById.mockResolvedValue({ id: 1 } as never);
    mockPurchaseService.updatePurchase.mockResolvedValue({ id: 1 } as never);
    mockPurchaseService.deletePurchase.mockResolvedValue(undefined);
  });

  it('carrega compras e atualiza estado base', async () => {
    let latest: CtxState | null = null;

    await act(async () => {
      TestRenderer.create(
        <PurchaseProvider>
          <Consumer onRender={(value) => { latest = value; }} />
        </PurchaseProvider>
      );
    });

    await act(async () => {
      await latest!.fetchPurchases({ page: 0, size: 20 });
    });

    expect(latest!.purchases).toHaveLength(1);
    expect(latest!.hasMore).toBe(false);
  });

  it('expõe erro quando falha no carregamento', async () => {
    let latest: CtxState | null = null;
    mockPurchaseService.getPurchases.mockRejectedValueOnce(new Error('falha compras'));

    await act(async () => {
      TestRenderer.create(
        <PurchaseProvider>
          <Consumer onRender={(value) => { latest = value; }} />
        </PurchaseProvider>
      );
    });

    await act(async () => {
      await latest!.fetchPurchases({ page: 0, size: 20 });
    });

    expect(latest!.error).toBe('falha compras');
  });
});
