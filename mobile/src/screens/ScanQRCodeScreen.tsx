import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NFCeWebView, QRCodeScanner } from '../components';
import { nfceService, purchaseService } from '../services';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { buildNFCeUrl, extractAccessKeyFromQRCode } from '../services/nfceService';
import { useTheme } from 'react-native-paper';
import { colors } from '../theme/colors';

type ScanQRCodeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ScanQRCode'>;
};

export const ScanQRCodeScreen: React.FC<ScanQRCodeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentAccessKey, setCurrentAccessKey] = useState('');

  const handleScan = async (data: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setShowCamera(false);

    try {
      if (__DEV__) {
        console.log('QR Code data:', data);
      }

      const url = buildNFCeUrl(data);
      if (__DEV__) {
        console.log('URL SEFAZ:', url);
      }

      const accessKey = extractAccessKeyFromQRCode(data);
      if (__DEV__) {
        console.log('Chave extraída:', accessKey);
      }

      setCurrentUrl(url);
      setCurrentAccessKey(accessKey);
      setShowWebView(true);
    } catch (error: any) {
      if (__DEV__) {
        console.log('Erro ao processar QR Code:', error);
      }
      setIsProcessing(false);
      showImportError('qr');
    }
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
  };

  const handleWebViewSuccess = async (scrapedData: any) => {
    try {
      if (__DEV__) {
        console.log('Dados extraídos:', scrapedData);
      }

      const result = await nfceService.createPurchaseFromScrapedData(
        scrapedData,
        currentAccessKey
      );

      if (__DEV__) {
        console.log('Compra salva:', result);
      }

      const purchase = await purchaseService.getPurchaseById(result.purchaseId);

      setShowWebView(false);
      setIsProcessing(false);

      Alert.alert('Sucesso', 'Nota fiscal importada com sucesso.');
      navigation.navigate('PurchaseDetail', { purchaseId: purchase.id });
    } catch (error: any) {
      if (__DEV__) {
        console.log('Erro ao salvar compra:', error);
      }
      setShowWebView(false);
      setIsProcessing(false);
      showImportError('save');
    }
  };

  const handleWebViewError = (error: string) => {
    if (__DEV__) {
      console.log('Erro na WebView:', error);
    }
    setShowWebView(false);
    setIsProcessing(false);
    showImportError(error);
  };

  const handleWebViewCancel = () => {
    setShowWebView(false);
    setIsProcessing(false);
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handleManualRegister = () => {
    navigation.navigate('PurchaseEdit', { purchaseId: 0 });
  };

  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  const showImportError = (reason?: string) => {
    let message = 'Você pode tentar novamente ou salvar manualmente.';

    if (typeof reason === 'string') {
      const lower = reason.toLowerCase();
      if (lower.includes('network') || lower.includes('conex') || lower.includes('internet')) {
        message = 'Sem internet no momento. Você pode tentar novamente ou salvar manualmente.';
      } else if (lower.includes('qr') || lower.includes('chave') || lower.includes('código')) {
        message = 'QR Code inválido. Você pode tentar novamente ou salvar manualmente.';
      } else if (lower.includes('tempo limite') || lower.includes('timeout') || lower.includes('servid')) {
        message = 'Nota fora do ar no momento. Você pode tentar novamente ou salvar manualmente.';
      }
    }

    Alert.alert(
      'Não foi possível importar esta nota.',
      message,
      [
        {
          text: 'Tentar novamente',
          onPress: () => {
            setShowCamera(true);
          },
        },
        {
          text: 'Salvar manualmente',
          onPress: () => navigation.navigate('PurchaseEdit', { purchaseId: 0 }),
        },
      ]
    );
  };

  // Se estiver mostrando a câmera, mostrar o QRCodeScanner
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <QRCodeScanner onScan={handleScan} onClose={handleCloseCamera} />
      </View>
    );
  }

  // Tela principal com design Figma
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primaryText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cadastro de Compras</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.mainCard}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="qrcode-scan" size={32} color={colors.primaryText} />
          </View>
          <Text style={styles.cardTitle}>Ler QR Code</Text>
          <Text style={styles.cardSubtitle}>
            Escaneie o QR Code da NFC-e
          </Text>

          <TouchableOpacity
            style={[styles.button, styles.photoButton]}
            onPress={handleTakePhoto}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.primaryText} style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Escanear QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.galleryButton, { opacity: 0.45 }]}
            disabled={true}
          >
            <MaterialCommunityIcons name="image" size={20} color={colors.primaryText} style={{ marginRight: 8 }} />
            <Text style={styles.buttonTextWhite}>Selecionar da Galeria</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ocrCard}>
          <View style={styles.ocrContent}>
            <View>
            <Text style={styles.ocrTitle}>Importação Automática</Text>
            <Text style={styles.ocrSubtitle}>
              Leitura via QR Code
            </Text>
            </View>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.manualButton}
          onPress={handleManualRegister}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.primaryText} style={{ marginRight: 8 }} />
          <Text style={styles.manualText}>Cadastrar Manualmente</Text>
        </TouchableOpacity>
      </View>

      <NFCeWebView
        visible={showWebView}
        url={currentUrl}
        onSuccess={handleWebViewSuccess}
        onError={handleWebViewError}
        onCancel={handleWebViewCancel}
        timeout={30000}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundApp,
  },
  cameraContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  photoButton: {
    backgroundColor: colors.primary,
  },
  galleryButton: {
    backgroundColor: colors.secondary,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextWhite: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  ocrCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  ocrContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ocrTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  ocrSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },
  manualButton: {
    backgroundColor: colors.success,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  manualText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
});
