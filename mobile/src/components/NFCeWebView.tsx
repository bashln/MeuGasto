import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator, Text, Button } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';
import { NFCE_ALLOWED_HOSTS } from '../services/nfceService';
import { NFCE_SCRAPE_SCRIPT } from '../utils/nfceScraperScript';

const DEBUG = __DEV__ || false;

interface NFCeItem {
  name: string;
  quantity: number;
  unit: string;
  unityPrice: number;
  totalPrice: number;
}

interface NFCeScrapedData {
  storeName: string;
  cnpj: string;
  city: string;
  state: string;
  date: string;
  time?: string;
  total: number;
  items: NFCeItem[];
}

interface NFCeWebViewProps {
  visible: boolean;
  url: string;
  onSuccess: (data: NFCeScrapedData) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  timeout?: number;
}

export const NFCeWebView: React.FC<NFCeWebViewProps> = ({
  visible,
  url,
  onSuccess,
  onError,
  onCancel,
  timeout = 30000,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [statusMessage, setStatusMessage] = useState('Isso pode levar alguns segundos.');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const injectScriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (errorDelayTimeoutRef.current) {
      clearTimeout(errorDelayTimeoutRef.current);
      errorDelayTimeoutRef.current = null;
    }

    if (injectScriptTimeoutRef.current) {
      clearTimeout(injectScriptTimeoutRef.current);
      injectScriptTimeoutRef.current = null;
    }
  };

  const isAllowedNavigation = (targetUrl?: string): boolean => {
    if (!targetUrl) return false;
    if (targetUrl === 'about:blank') return true;

    try {
      const parsed = new URL(targetUrl);
      return NFCE_ALLOWED_HOSTS.has(parsed.hostname);
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (visible) {
      setStatusMessage('Isso pode levar alguns segundos.');

      // Configurar timeout
      clearAllTimeouts();
      timeoutRef.current = setTimeout(() => {
        if (webViewRef.current) {
          setStatusMessage('Tempo limite excedido. Tente novamente.');
          errorDelayTimeoutRef.current = setTimeout(() => {
            onError('Tempo limite excedido ao carregar a nota fiscal. Verifique sua conexão e tente novamente.');
          }, 2000);
        }
      }, timeout);
    } else {
      clearAllTimeouts();
    }

    return () => {
      clearAllTimeouts();
    };
  }, [visible, timeout, onError]);

  const handleMessage = (event: { nativeEvent: { data?: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data ?? '{}');
      
      if (DEBUG) {
        console.warn('[NFCeWebView] Mensagem recebida:', message.type);
      }

      if (message.type === 'NFCE_DEBUG' && DEBUG) {
        console.warn('[NFCeWebView] Debug:', message.message);
        setStatusMessage(message.message);
      } else if (message.type === 'NFCE_SCRAPE_RESULT') {
        clearAllTimeouts();
        if (message.ok) {
          onSuccess(message.data);
        } else {
          onError(message.error || 'Erro ao extrair dados da nota fiscal');
        }
      }
    } catch (e) {
      console.error('[NFCeWebView] Erro ao parsear mensagem:', e);
    }
  };

  const handleLoadEnd = () => {
    setStatusMessage('Extraindo dados da nota...');

    // Injetar script após carregamento
    if (webViewRef.current) {
      if (injectScriptTimeoutRef.current) {
        clearTimeout(injectScriptTimeoutRef.current);
      }

      injectScriptTimeoutRef.current = setTimeout(() => {
        webViewRef.current?.injectJavaScript(NFCE_SCRAPE_SCRIPT);
      }, 1000);
    }
  };

  const handleNavigationStateChange = (navState: { loading: boolean }) => {
    if (navState.loading) {
      setStatusMessage('Carregando...');
    } else {
      setStatusMessage('Processando dados...');
    }
  };

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    const isAllowed = isAllowedNavigation(request.url);

    if (!isAllowed) {
      onError('Navegação bloqueada por segurança. Tente novamente.');
      return false;
    }

    return true;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Importando nota fiscal...</Text>
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>

        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess={false}
          allowsBackForwardNavigationGestures={true}
        />

        <View style={styles.footer}>
            <Button
              title="Cancelar"
              onPress={onCancel}
              color={colors.danger}
            />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    padding: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusMessage: {
    color: colors.primaryText,
    fontSize: 14,
    marginTop: 4,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  footer: {
    padding: 16,
    backgroundColor: colors.surfaceAlt,
  },
});
