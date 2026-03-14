import { useState, useEffect, useCallback } from 'react';
import { updateService, UpdateInfo } from '../services/updateService';
import appConfig from '../../app.json';

const APP_VERSION = appConfig?.expo?.version || '1.0.0';

interface UseUpdateCheckResult {
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  dismiss: () => void;
  checkNow: () => Promise<void>;
}

export const useUpdateCheck = (): UseUpdateCheckResult => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (isDismissed) return;
    
    setIsChecking(true);
    try {
      const info = await updateService.checkForUpdate(APP_VERSION);
      if (info && !isDismissed) {
        setUpdateInfo(info);
      }
    } finally {
      setIsChecking(false);
    }
  }, [isDismissed]);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    setUpdateInfo(null);
  }, []);

  useEffect(() => {
    // Check on mount
    void checkForUpdate();
  }, [checkForUpdate]);

  return {
    updateInfo,
    isChecking,
    dismiss,
    checkNow: checkForUpdate,
  };
};
