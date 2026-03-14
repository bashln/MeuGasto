import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const LAST_CHECKED_KEY = 'update.last_checked';
const LATEST_VERSION_KEY = 'update.latest_version';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_API_URL = 'https://api.github.com/repos/bashln/MeuGasto/releases/latest';
const REQUEST_TIMEOUT_MS = 8000;
const APK_DOWNLOAD_DIR = 'updates';
const APK_FILENAME = 'meugasto-latest.apk';

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  isUpdateAvailable: boolean;
  isMandatory: boolean;
  releasePageUrl: string;
  apkDownloadUrl: string | null;
  releaseNotes: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body: string | null;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const logUpdateError = (message: string, error: unknown) => {
  if (__DEV__) {
    console.warn(message, error);
  }
};

/**
 * Compare two semantic versions (e.g., "1.2.3" vs "1.3.0")
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export const compareVersions = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  const maxLength = Math.max(partsA.length, partsB.length);
  
  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    
    if (numA !== numB) {
      return numA - numB;
    }
  }
  
  return 0;
};

/**
 * Extract minVersion from release body
 * Looks for pattern: minVersion: 1.2.3
 */
const extractMinVersion = (body: string | null): string | null => {
  if (!body) return null;
  const match = body.match(/^minVersion:\s*(\d+\.\d+\.\d+)/m);
  return match ? match[1] : null;
};

/**
 * Extract APK download URL from release assets
 */
const extractApkUrl = (release: GitHubRelease): string | null => {
  const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
  return apkAsset?.browser_download_url || null;
};

/**
 * Check if update should be skipped due to cache
 */
const shouldSkipCheck = async (): Promise<boolean> => {
  try {
    const lastChecked = await SecureStore.getItemAsync(LAST_CHECKED_KEY);
    if (!lastChecked) return false;
    
    const lastCheckTime = parseInt(lastChecked, 10);
    const now = Date.now();
    
    return now - lastCheckTime < CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
};

/**
 * Update the last check timestamp
 */
const updateLastChecked = async (): Promise<void> => {
  try {
    await SecureStore.setItemAsync(LAST_CHECKED_KEY, Date.now().toString());
  } catch (error) {
    logUpdateError('[Update] Failed to update last checked timestamp', error);
  }
};

export type DownloadApkProgressCallback = (progress: number) => void;

export const downloadApk = async (
  url: string,
  onProgress?: DownloadApkProgressCallback
): Promise<string | null> => {
  try {
    if (!FileSystem.cacheDirectory) {
      logUpdateError('[Update] Cache directory unavailable for APK download', null);
      return null;
    }

    const updateDir = `${FileSystem.cacheDirectory}${APK_DOWNLOAD_DIR}`;
    const apkUri = `${updateDir}/${APK_FILENAME}`;

    await FileSystem.makeDirectoryAsync(updateDir, { intermediates: true });

    const existingFile = await FileSystem.getInfoAsync(apkUri);
    if (existingFile.exists) {
      await FileSystem.deleteAsync(apkUri, { idempotent: true });
    }

    const downloadTask = FileSystem.createDownloadResumable(
      url,
      apkUri,
      {},
      (downloadData) => {
        if (!onProgress || downloadData.totalBytesExpectedToWrite <= 0) {
          return;
        }

        const progress = downloadData.totalBytesWritten / downloadData.totalBytesExpectedToWrite;
        onProgress(Math.max(0, Math.min(1, progress)));
      }
    );

    const result = await downloadTask.downloadAsync();
    onProgress?.(1);

    return result?.uri || null;
  } catch (error) {
    logUpdateError('[Update] Failed to download APK', error);
    return null;
  }
};

export const updateService = {
  /**
   * Check for available updates from GitHub Releases
   * Returns null on error or if no update is needed
   */
  async checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
    try {
      // Skip if checked recently
      if (await shouldSkipCheck()) {
        const cachedVersion = await SecureStore.getItemAsync(LATEST_VERSION_KEY);
        if (cachedVersion) {
          const comparison = compareVersions(cachedVersion, currentVersion);
          if (comparison <= 0) {
            return null; // No update available
          }
        }
      }

      // Fetch latest release from GitHub
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(GITHUB_API_URL, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'MeuGasto-App',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logUpdateError('[Update] GitHub API error', { status: response.status });
        return null;
      }

      const release: GitHubRelease = await response.json();
      
      // Extract version from tag (remove 'v' prefix if present)
      const latestVersion = release.tag_name.replace(/^v/, '');
      
      // Cache the latest version
      await SecureStore.setItemAsync(LATEST_VERSION_KEY, latestVersion);
      await updateLastChecked();

      // Compare versions
      const comparison = compareVersions(latestVersion, currentVersion);
      
      if (comparison <= 0) {
        return null; // No update available
      }

      // Check if update is mandatory
      const minVersion = extractMinVersion(release.body);
      const isMandatory = minVersion ? compareVersions(currentVersion, minVersion) < 0 : false;

      // Extract APK URL or use release page as fallback
      const apkDownloadUrl = extractApkUrl(release);

      return {
        latestVersion,
        currentVersion,
        isUpdateAvailable: true,
        isMandatory,
        releasePageUrl: release.html_url,
        apkDownloadUrl,
        releaseNotes: release.body || '',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logUpdateError('[Update] Request timeout', error);
      } else {
        logUpdateError('[Update] Failed to check for updates', error);
      }
      return null;
    }
  },

  /**
   * Clear update check cache
   */
  async clearCache(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(LAST_CHECKED_KEY);
      await SecureStore.deleteItemAsync(LATEST_VERSION_KEY);
    } catch (error) {
      logUpdateError('[Update] Failed to clear cache', error);
    }
  },
};
