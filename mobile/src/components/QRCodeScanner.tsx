import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Text, useTheme, Surface } from 'react-native-paper';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose }) => {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Verificando permissão da câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Surface style={styles.permissionCard} elevation={2}>
          <Text variant="titleMedium" style={styles.permissionTitle}>
            Permissão necessária
          </Text>
          <Text variant="bodyMedium" style={styles.permissionText}>
            Precisamos de acesso à câmera para escanear o QR Code da nota fiscal.
          </Text>
          <Button mode="contained" onPress={requestPermission} style={styles.permissionButton}>
            Permitir acesso
          </Button>
          <Button mode="text" onPress={onClose} style={styles.cancelButton}>
            Cancelar
          </Button>
        </Surface>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay}>
          <Text style={styles.instructionText}>
            Posicione o QR Code dentro da área
          </Text>
          {scanned && (
            <Button
              mode="contained"
              onPress={() => setScanned(false)}
              style={styles.rescanButton}
            >
              Escanear novamente
            </Button>
          )}
          <Button mode="text" onPress={onClose} textColor="#fff" style={styles.closeButton}>
            Fechar
          </Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 250,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    paddingTop: 30,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  rescanButton: {
    marginBottom: 10,
  },
  closeButton: {
    marginTop: 10,
  },
  permissionCard: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  permissionTitle: {
    marginBottom: 10,
    fontWeight: '600',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    width: '100%',
  },
  cancelButton: {
    marginTop: 10,
  },
});
