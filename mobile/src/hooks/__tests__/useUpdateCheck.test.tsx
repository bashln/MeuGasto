jest.mock('../../services/updateService', () => ({
  updateService: {
    checkForUpdate: jest.fn(),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useUpdateCheck } from '../useUpdateCheck';
import { updateService } from '../../services/updateService';

const mockUpdateService = updateService as jest.Mocked<typeof updateService>;

type HookState = ReturnType<typeof useUpdateCheck>;

const HookHarness = ({ onRender }: { onRender: (value: HookState) => void }) => {
  const state = useUpdateCheck();
  onRender(state);
  return null;
};

describe('useUpdateCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executa checagem no mount e popula updateInfo', async () => {
    mockUpdateService.checkForUpdate.mockResolvedValue({
      latestVersion: '1.4.0',
      currentVersion: '1.3.0',
      isUpdateAvailable: true,
      isMandatory: false,
      releasePageUrl: 'https://example.com',
      apkDownloadUrl: null,
      releaseNotes: 'nova versão',
    });

    const snapshots: HookState[] = [];

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => snapshots.push(value)} />);
    });

    expect(mockUpdateService.checkForUpdate).toHaveBeenCalledWith('1.3.0');
    expect(snapshots[snapshots.length - 1].updateInfo?.latestVersion).toBe('1.4.0');
  });

  it('dismiss limpa updateInfo e impede novas atualizações', async () => {
    mockUpdateService.checkForUpdate.mockResolvedValue({
      latestVersion: '1.4.0',
      currentVersion: '1.3.0',
      isUpdateAvailable: true,
      isMandatory: false,
      releasePageUrl: 'https://example.com',
      apkDownloadUrl: null,
      releaseNotes: 'nova versão',
    });

    let latest: HookState | null = null;

    await act(async () => {
      TestRenderer.create(<HookHarness onRender={(value) => { latest = value; }} />);
    });

    await act(async () => {
      latest!.dismiss();
    });

    await act(async () => {
      await latest!.checkNow();
    });

    expect(latest!.updateInfo).toBeNull();
    expect(mockUpdateService.checkForUpdate).toHaveBeenCalledTimes(1);
  });
});
