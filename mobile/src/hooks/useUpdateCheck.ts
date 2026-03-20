import { useState, useEffect, useCallback } from 'react';
import { updateService, UpdateInfo } from '../services/updateService';
import appConfig from '../../app.json';

const APP_VERSION = appConfig?.expo?.version || '1.0.0';

interface UseUpdateCheckResult {
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  error: Error | null;
  dismiss: () => void;
  checkNow: () => Promise<void>;
}

export const useUpdateCheck = (): UseUpdateCheckResult => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (isDismissed) return;

    setIsChecking(true);
    setError(null);
    try {
      const info = await updateService.checkForUpdate(APP_VERSION);
      if (info && !isDismissed) {
        setUpdateInfo(info);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Update check failed'));
    } finally {
      setIsChecking(false);
    }
  }, [isDismissed]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    setUpdateInfo(null);
  }, []);

  useEffect(() => {
    // Run once on mount. checkForUpdate is intentionally omitted from deps to avoid
    // re-triggering on dismiss changes; isDismissed is guarded inside the callback.
    void checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    updateInfo,
    isChecking,
    error,
    dismiss,
    checkNow: checkForUpdate,
  };
};
