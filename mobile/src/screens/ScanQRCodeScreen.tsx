import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Dimensions } from 'react-native';
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
      console.log('QR Code data:', data);
      
      const url = buildNFCeUrl(data);
      console.log('URL SEFAZ:', url);
      
      const accessKey = extractAccessKeyFromQRCode(data);
      console.log('Chave extraída:', accessKey);
      
      setCurrentUrl(url);
      setCurrentAccessKey(accessKey);
      setShowWebView(true);
      
    } catch (error: any) {
      console.log('Erro ao processar QR Code:', error);
      Alert.alert('Erro', error.message || 'Erro ao processar código QR');
      setIsProcessing(false);
    }
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
  };

  const handleWebViewSuccess = async (scrapedData: any) => {
    try {
      console.log('Dados extraídos:', scrapedData);
      
      const result = await nfceService.createPurchaseFromScrapedData(
        scrapedData,
        currentAccessKey
      );
      
      console.log('Compra salva:', result);
      
      const purchase = await purchaseService.getPurchaseById(result.purchaseId);
      
      setShowWebView(false);
      setIsProcessing(false);
      
      Alert.alert(
        'Sucesso!',
        `Compra do(a) ${purchase.supermarket?.name || 'supermercado'} registrada com sucesso!\nTotal: R$ ${purchase.totalPrice.toFixed(2)}`,
        [
          {
            text: 'Ver Detalhes',
            onPress: () => navigation.navigate('PurchaseDetail', { purchaseId: purchase.id }),
          },
          {
            text: 'Voltar',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.log('Erro ao salvar compra:', error);
      setShowWebView(false);
      setIsProcessing(false);
      Alert.alert('Erro', error.message || 'Erro ao salvar a compra');
    }
  };

  const handleWebViewError = (error: string) => {
    console.log('Erro na WebView:', error);
    setShowWebView(false);
    setIsProcessing(false);
    Alert.alert('Erro', error);
  };

  const handleWebViewCancel = () => {
    setShowWebView(false);
    setIsProcessing(false);
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handleManualRegister = () => {
    Alert.alert('Em breve', 'Funcionalidade de cadastro manual em desenvolvimento');
  };

  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  const handleSelectFromGallery = () => {
    Alert.alert('Em breve', 'Seleção de imagem da galeria em desenvolvimento');
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
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cadastro de Compras</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.mainCard}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📄</Text>
          </View>
          <Text style={styles.cardTitle}>Adicionar Nota Fiscal</Text>
          <Text style={styles.cardSubtitle}>
            Capture ou selecione uma imagem da sua nota fiscal
          </Text>

          <TouchableOpacity 
            style={[styles.button, styles.photoButton]} 
            onPress={handleTakePhoto}
          >
            <Text style={styles.buttonIcon}>📷</Text>
            <Text style={styles.buttonText}>Tirar Foto</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.galleryButton]} 
            onPress={handleSelectFromGallery}
          >
            <Text style={styles.buttonIcon}>🖼️</Text>
            <Text style={styles.buttonTextWhite}>Selecionar da Galeria</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ocrCard}>
          <View style={styles.ocrContent}>
            <View>
              <Text style={styles.ocrTitle}>OCR Automático</Text>
              <Text style={styles.ocrSubtitle}>
                Extração automática de dados
              </Text>
            </View>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.manualButton} 
          onPress={handleManualRegister}
        >
          <Text style={styles.manualIcon}>+</Text>
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
  backIcon: {
    color: colors.primaryText,
    fontSize: 24,
    fontWeight: '600',
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
  icon: {
    fontSize: 32,
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
  buttonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextWhite: {
    color: '#fff',
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
  checkIcon: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '600',
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
  manualIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  manualText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
