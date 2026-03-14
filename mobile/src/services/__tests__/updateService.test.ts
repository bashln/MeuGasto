jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { updateService, compareVersions } from '../updateService';
import * as SecureStore from 'expo-secure-store';

const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

describe('updateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('compareVersions', () => {
    it('returns 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
      expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
    });

    it('returns negative when a < b', () => {
      expect(compareVersions('1.2.3', '1.2.4')).toBeLessThan(0);
      expect(compareVersions('1.2.3', '1.3.0')).toBeLessThan(0);
      expect(compareVersions('1.2.3', '2.0.0')).toBeLessThan(0);
      expect(compareVersions('0.9.9', '1.0.0')).toBeLessThan(0);
    });

    it('returns positive when a > b', () => {
      expect(compareVersions('1.2.4', '1.2.3')).toBeGreaterThan(0);
      expect(compareVersions('1.3.0', '1.2.3')).toBeGreaterThan(0);
      expect(compareVersions('2.0.0', '1.2.3')).toBeGreaterThan(0);
      expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0);
    });

    it('handles different version lengths', () => {
      expect(compareVersions('1.2', '1.2.0')).toBe(0);
      expect(compareVersions('1.2.0', '1.2')).toBe(0);
      expect(compareVersions('1', '1.0.0')).toBe(0);
    });
  });

  describe('checkForUpdate', () => {
    const mockRelease = {
      tag_name: 'v1.2.4',
      html_url: 'https://github.com/bashln/MeuGasto/releases/tag/v1.2.4',
      body: '## Novidades\n- Feature X\n- Bug fix Y',
      assets: [
        { name: 'app-release.apk', browser_download_url: 'https://github.com/.../app-release.apk' },
        { name: 'source.zip', browser_download_url: 'https://github.com/.../source.zip' },
      ],
    };

    it('returns null when cache is fresh and no update available', async () => {
      const now = Date.now();
      mockGetItemAsync
        .mockResolvedValueOnce(now.toString()) // last_checked
        .mockResolvedValueOnce('1.2.3'); // latest_version

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('fetches from GitHub when cache is stale', async () => {
      const oldTime = (Date.now() - 25 * 60 * 60 * 1000).toString(); // 25 hours ago
      mockGetItemAsync
        .mockResolvedValueOnce(oldTime) // last_checked
        .mockResolvedValueOnce(null); // latest_version

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRelease,
      });

      const result = await updateService.checkForUpdate('1.2.3');
      
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/bashln/MeuGasto/releases/latest',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json',
          }),
        })
      );
      expect(result).not.toBeNull();
      expect(result?.latestVersion).toBe('1.2.4');
      expect(result?.isUpdateAvailable).toBe(true);
    });

    it('returns null when current version is up to date', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockRelease, tag_name: 'v1.2.3' }),
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).toBeNull();
    });

    it('detects mandatory updates from release body', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockRelease,
          tag_name: 'v1.3.0',
          body: 'minVersion: 1.2.5\n\n## Novidades\n- Breaking changes',
        }),
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).not.toBeNull();
      expect(result?.isMandatory).toBe(true);
      expect(result?.latestVersion).toBe('1.3.0');
    });

    it('marks update as optional when no minVersion specified', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockRelease,
          tag_name: 'v1.2.4',
        }),
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).not.toBeNull();
      expect(result?.isMandatory).toBe(false);
    });

    it('extracts APK download URL correctly', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRelease,
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result?.apkDownloadUrl).toBe('https://github.com/.../app-release.apk');
    });

    it('uses release page URL as fallback when no APK', async () => {
      mockGetItemAsync.mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockRelease,
          assets: [{ name: 'source.zip', browser_download_url: 'https://github.com/.../source.zip' }],
        }),
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result?.apkDownloadUrl).toBeNull();
      expect(result?.releasePageUrl).toBe('https://github.com/bashln/MeuGasto/releases/tag/v1.2.4');
    });

    it('returns null on network error', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).toBeNull();
    });

    it('returns null on HTTP error', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).toBeNull();
    });

    it('handles timeout gracefully', async () => {
      mockGetItemAsync.mockResolvedValue(null);
      
      // Use AbortError which is what happens when AbortController times out
      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const result = await updateService.checkForUpdate('1.2.3');
      expect(result).toBeNull();
    }, 1000);
  });

  describe('clearCache', () => {
    it('clears stored cache keys', async () => {
      await updateService.clearCache();
      
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('update.last_checked');
      expect(mockDeleteItemAsync).toHaveBeenCalledWith('update.latest_version');
    });
  });
});
