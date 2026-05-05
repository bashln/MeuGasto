jest.mock('../../services', () => ({
  draftService: {
    getDrafts: jest.fn(),
    getDraftById: jest.fn(),
    createDraft: jest.fn(),
    updateDraft: jest.fn(),
    deleteDraft: jest.fn(),
    convertDraftToPurchase: jest.fn(),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DraftProvider, useDrafts } from '../DraftContext';
import { draftService } from '../../services';

const mockDraftService = draftService as jest.Mocked<typeof draftService>;

type CtxState = ReturnType<typeof useDrafts>;

const Consumer = ({ onRender }: { onRender: (value: CtxState) => void }) => {
  const value = useDrafts();
  onRender(value);
  return null;
};

describe('DraftContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDraftService.getDrafts.mockResolvedValue({
      data: [{ id: 1, content: 'rascunho', totalPrice: 20, createdAt: '', updatedAt: '' } as never],
      page: { pageNumber: 0, pageSize: 20, totalElements: 1, totalPages: 1, last: true },
    });
    mockDraftService.getDraftById.mockResolvedValue({ id: 1 } as never);
    mockDraftService.createDraft.mockResolvedValue({ id: 1 } as never);
    mockDraftService.updateDraft.mockResolvedValue({ id: 1 } as never);
    mockDraftService.deleteDraft.mockResolvedValue(undefined);
    mockDraftService.convertDraftToPurchase.mockResolvedValue(undefined);
  });

  it('carrega rascunhos e atualiza estado base', async () => {
    let latest: CtxState | null = null;

    await act(async () => {
      TestRenderer.create(
        <DraftProvider>
          <Consumer onRender={(value) => { latest = value; }} />
        </DraftProvider>
      );
    });

    await act(async () => {
      await latest!.fetchDrafts({ page: 0, size: 20 });
    });

    expect(latest!.drafts).toHaveLength(1);
    expect(latest!.hasMore).toBe(false);
  });

  it('executa convertToPurchase e recarrega lista', async () => {
    let latest: CtxState | null = null;

    await act(async () => {
      TestRenderer.create(
        <DraftProvider>
          <Consumer onRender={(value) => { latest = value; }} />
        </DraftProvider>
      );
    });

    await act(async () => {
      await latest!.convertToPurchase(1);
    });

    expect(mockDraftService.convertDraftToPurchase).toHaveBeenCalledWith(1);
    expect(mockDraftService.getDrafts).toHaveBeenCalled();
  });
});
