import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { UpdateInfo, downloadApk } from '../services/updateService';

interface UpdateDialogProps {
  updateInfo: UpdateInfo;
  onDismiss: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  updateInfo,
  onDismiss,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const handleUpdate = async () => {
    if (isDownloading) {
      return;
    }

    try {
      const isAndroid = Platform.OS === 'android';
      const canInstallApk = isAndroid && Boolean(updateInfo.apkDownloadUrl);

      if (canInstallApk && updateInfo.apkDownloadUrl) {
        setIsDownloading(true);
        setDownloadProgress(0);

        const localApkPath = await downloadApk(updateInfo.apkDownloadUrl, setDownloadProgress);

        if (localApkPath) {
          const contentUri = await FileSystem.getContentUriAsync(localApkPath);

          try {
            await IntentLauncher.startActivityAsync(
              'android.intent.action.INSTALL_PACKAGE',
              {
                data: contentUri,
                flags: 0x10000000 | 0x00000001,
              }
            );
          } catch {
            try {
              await IntentLauncher.startActivityAsync(
                'android.intent.action.VIEW',
                {
                  data: contentUri,
                  type: 'application/vnd.android.package-archive',
                  flags: 0x10000000 | 0x00000001,
                }
              );
            } catch {
              if (updateInfo.apkDownloadUrl) {
                await Linking.openURL(updateInfo.apkDownloadUrl);
              }
            }
          }

          if (!updateInfo.isMandatory) {
            onDismiss();
          }

          return;
        }
      }

      const fallbackUrl = updateInfo.apkDownloadUrl || updateInfo.releasePageUrl;
      if (fallbackUrl) {
        const canOpen = await Linking.canOpenURL(fallbackUrl);
        if (canOpen) {
          await Linking.openURL(fallbackUrl);
        }
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }

    // Don't dismiss on mandatory updates
    if (!updateInfo.isMandatory) {
      onDismiss();
    }
  };

  const handleDismiss = () => {
    if (!updateInfo.isMandatory) {
      onDismiss();
    }
  };

  return (
    <Modal
      transparent
      visible={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={updateInfo.isMandatory ? 'alert-circle' : 'update'}
              size={48}
              color={updateInfo.isMandatory ? colors.danger : colors.primary}
            />
          </View>

          <Text style={styles.title}>
            {updateInfo.isMandatory ? 'Atualização Obrigatória' : 'Nova Versão Disponível'}
          </Text>

          <Text style={styles.version}>
            v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
          </Text>

          {updateInfo.releaseNotes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>Novidades:</Text>
              <Text style={styles.notesText} numberOfLines={5}>
                {updateInfo.releaseNotes.replace(/^minVersion:\s*\d+\.\d+\.\d+$/m, '').trim()}
              </Text>
            </View>
          ) : null}

          <View style={styles.buttonContainer}>
            {!updateInfo.isMandatory && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleDismiss}
                disabled={isDownloading}
              >
                <Text style={styles.secondaryButtonText}>Agora não</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButton, isDownloading && styles.buttonDisabled]}
              onPress={handleUpdate}
              disabled={isDownloading}
            >
              <Text style={styles.primaryButtonText}>
                {isDownloading
                  ? 'Baixando...'
                  : updateInfo.isMandatory
                    ? 'Atualizar Agora'
                    : 'Atualizar'}
              </Text>
            </TouchableOpacity>
          </View>

          {isDownloading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.progressText}>
                {downloadProgress !== null
                  ? `Progresso: ${Math.round(downloadProgress * 100)}%`
                  : 'Preparando download...'}
              </Text>
            </View>
          )}

          {updateInfo.isMandatory && (
            <Text style={styles.mandatoryText}>
              Esta versão é necessária para continuar usando o app.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    color: colors.mutedText,
    marginBottom: 16,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: colors.mutedText,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: colors.mutedText,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  progressContainer: {
    marginTop: 14,
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 13,
    color: colors.mutedText,
  },
  mandatoryText: {
    fontSize: 12,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 12,
  },
});
