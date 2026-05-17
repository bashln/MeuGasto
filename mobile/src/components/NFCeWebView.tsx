import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator, Text, Button } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';
import { NFCeScrapedData, validateAndSanitizeNFCePayload } from '../lib/nfcePayloadValidation';
import { isAllowedNfceUrl } from '../services/nfceService';
import { parseRjHtml } from '../services/nfceHttpImportService';
import { getNfceScrapeScript, getNfceScrapeScriptByAccessKey } from '../utils/nfceScraperScript';

const DEBUG = __DEV__ || false;
const RJ_COMPAT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

interface WebViewNavigationRequest {
  url: string;
  isTopFrame?: boolean;
}

interface WebViewNavState {
  loading: boolean;
  url?: string;
}

interface NFCeWebViewProps {
  visible: boolean;
  url: string;
  accessKey: string;
  onSuccess: (data: NFCeScrapedData) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  timeout?: number;
}

export const shouldAllowNfceNavigationRequest = (request: WebViewNavigationRequest): boolean => {
  if (!request.url) {
    return false;
  }

  if (request.url === 'about:blank') {
    return true;
  }

  // Só validamos com rigor a navegação principal.
  // Recursos internos (scripts/css/iframes) podem usar urls auxiliares e não devem acionar bloqueio.
  if (request.isTopFrame !== true) {
    return true;
  }

  return isAllowedNfceUrl(request.url, { requireExpectedPath: true });
};

export const NFCeWebView: React.FC<NFCeWebViewProps> = ({
  visible,
  url,
  accessKey,
  onSuccess,
  onError,
  onCancel,
  timeout = 30000,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [statusMessage, setStatusMessage] = useState('Isso pode levar alguns segundos.');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absoluteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const injectScriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reinjectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rjSnapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scraperInjectedRef = useRef(false);
  const emergencyExtractionTriggeredRef = useRef(false);

  const injectRjHtmlSnapshot = () => {
    webViewRef.current?.injectJavaScript(`
      (function () {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'NFCE_HTML_SNAPSHOT',
            href: window.location && window.location.href ? window.location.href : '',
            html: document.documentElement ? document.documentElement.outerHTML : ''
          }));
        } catch (e) {}
      })();
      true;
    `);
  };

  const startRjFinalExtraction = () => {
    injectRjHtmlSnapshot();

    // O portal RJ renderiza a NFC-e depois de scripts anti-bot; repetir o snapshot
    // evita depender do instante exato em que o WebView dispara load/navigation.
    if (!rjSnapshotIntervalRef.current) {
      rjSnapshotIntervalRef.current = setInterval(() => {
        injectRjHtmlSnapshot();
      }, 2500);
    }

    if (!emergencyExtractionTriggeredRef.current && webViewRef.current) {
      emergencyExtractionTriggeredRef.current = true;
      webViewRef.current.injectJavaScript(buildEmergencyExtractionScript());
    }
  };

  const buildEmergencyExtractionScript = () => `
    (function () {
      try {
        var TYPE = 'NFCE_SCRAPE_RESULT';
        function post(payload){ window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
        function txt(sel){ var e=document.querySelector(sel); return (e&&(e.textContent||e.innerText)||'').trim(); }
        function normMoney(v){ var c=(v||'').replace(/\\./g,'').replace(',', '.').replace(/[^\\d.]/g,''); var n=Number(c); return Number.isFinite(n)?n:0; }
        function normQty(v){ var c=(v||'').replace(/\\./g,'').replace(',', '.').replace(/[^\\d.]/g,''); var n=Number(c); return Number.isFinite(n)&&n>0?n:1; }
        var rows = Array.from(document.querySelectorAll('#tabResult tr'));
        var items = rows.map(function(r){
          var name = txt.call(null, '.txtTit');
          name = ((r.querySelector('.txtTit')||{}).textContent||'').trim();
          var qtyRaw = ((r.querySelector('.Rqtd')||{}).textContent||'').match(/([\\d.,]+)/);
          var unitRaw = ((r.querySelector('.RUN')||{}).textContent||'').match(/UN:\\s*([A-Z]{1,5})/i);
          var upRaw = ((r.querySelector('.RvlUnit')||{}).textContent||'').match(/([\\d.,]+)\\s*$/);
          var tpRaw = ((r.querySelector('.valor')||{}).textContent||'').trim();
          if(!name) return null;
          var q = normQty(qtyRaw?qtyRaw[1]:'1');
          var up = normMoney(upRaw?upRaw[1]:'0');
          var tp = normMoney(tpRaw||'0');
          if(!up && q>0 && tp>0){ up = tp/q; }
          return { name:name, quantity:q, unit:(unitRaw?unitRaw[1]:'UN'), unityPrice:up||tp||0, totalPrice:tp||0 };
        }).filter(Boolean);

        // Fallback por spans visíveis quando a linha não está estruturada.
        if (!items.length) {
          var spans = Array.from(document.querySelectorAll('span.txtTit'));
          items = spans.map(function(sp){
            var row = sp.closest('tr') || sp.parentElement;
            var name = ((sp.textContent||'').trim());
            if(!name) return null;
            var rowText = ((row && (row.textContent || row.innerText)) || '').replace(/\\s+/g, ' ');
            var qtyM = rowText.match(/Qtde\\.:?\\s*([\\d.,]+)/i);
            var unitM = rowText.match(/UN:\\s*([A-Z]{1,5})/i);
            var unitPriceM = rowText.match(/Vl\\.\\s*Unit\\.:?\\s*([\\d.,]+)/i);
            var totalM = rowText.match(/Vl\\.\\s*Total\\s*([\\d.,]+)/i);
            var q = normQty(qtyM ? qtyM[1] : '1');
            var u = (unitM ? unitM[1] : 'UN').toUpperCase();
            var up = normMoney(unitPriceM ? unitPriceM[1] : '0');
            var tp = normMoney(totalM ? totalM[1] : '0');
            if(!up && q>0 && tp>0){ up = tp/q; }
            return { name:name, quantity:q, unit:u, unityPrice:up||tp||0, totalPrice:tp||0 };
          }).filter(Boolean);
        }

        // Fallback por texto bruto quando tabela ainda não está acessível.
        if (!items.length) {
          var raw = (document.body && (document.body.innerText || document.body.textContent) || '').replace(/\\s+/g, ' ');
          var re = /([A-Z0-9À-ÿ][A-Z0-9À-ÿ\\s\\-\\/\\.\\(\\),]{3,}?)\\s*\\(C[óo]digo:\\s*\\d+\\s*\\)\\s*Qtde\\.:?\\s*([\\d.,]+)\\s*UN:\\s*([A-Z]{1,5})\\s*Vl\\.\\s*Unit\\.:?\\s*([\\d.,]+)\\s*Vl\\.\\s*Total\\s*([\\d.,]+)/gi;
          var m;
          while ((m = re.exec(raw)) !== null) {
            var n = (m[1] || '').trim();
            var q2 = normQty(m[2] || '1');
            var u2 = (m[3] || 'UN').toUpperCase();
            var up2 = normMoney(m[4] || '0');
            var tp2 = normMoney(m[5] || '0');
            if (!up2 && q2 > 0 && tp2 > 0) { up2 = tp2 / q2; }
            if (n) {
              items.push({ name:n, quantity:q2, unit:u2, unityPrice:up2||tp2||0, totalPrice:tp2||0 });
            }
          }
        }

        var total = normMoney(txt('#totalNota .txtMax') || txt('.txtMax'));
        var store = txt('#u20') || txt('.txtTopo') || 'Estabelecimento';
        var cnpj = ((document.body.innerText||'').match(/\\b\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}\\b/)||[''])[0];
        var chave = (((document.body.innerText||'').match(/(?:\\d\\s*){44}/)||[''])[0] || '').replace(/\\D/g,'');

        if(items.length===0){
          var bodyText = (document.body && (document.body.innerText || document.body.textContent) || '').replace(/\\s+/g, ' ').trim();
          var rowCount = document.querySelectorAll('#tabResult tr[id^="Item"]').length;
          var preview = bodyText.slice(0, 240);
          post({
            type: 'NFCE_DEBUG',
            message:'Aguardando DOM final. url=' + (window.location && window.location.href ? window.location.href : '') + ' rowCount=' + rowCount + ' preview=' + preview
          });
          return;
        }
        post({ type: TYPE, ok:true, data:{ storeName:store, cnpj:cnpj, accessKey:(chave.length===44?chave:''), state:'RJ', total: total || items.reduce(function(a,i){return a+(i.totalPrice||0)},0), items:items }});
      } catch(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'NFCE_SCRAPE_RESULT', ok:false, error:'Falha na extração de emergência.' }));
      }
    })();
    true;
  `;

  const clearAllTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (absoluteTimeoutRef.current) {
      clearTimeout(absoluteTimeoutRef.current);
      absoluteTimeoutRef.current = null;
    }

    if (errorDelayTimeoutRef.current) {
      clearTimeout(errorDelayTimeoutRef.current);
      errorDelayTimeoutRef.current = null;
    }

    if (injectScriptTimeoutRef.current) {
      clearTimeout(injectScriptTimeoutRef.current);
      injectScriptTimeoutRef.current = null;
    }

    if (reinjectIntervalRef.current) {
      clearInterval(reinjectIntervalRef.current);
      reinjectIntervalRef.current = null;
    }

    if (rjSnapshotIntervalRef.current) {
      clearInterval(rjSnapshotIntervalRef.current);
      rjSnapshotIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (visible) {
      if (!isAllowedNfceUrl(url, { requireExpectedPath: true })) {
        onError('URL NFC-e bloqueada por seguranca.');
        return;
      }

      setStatusMessage('Isso pode levar alguns segundos.');
      scraperInjectedRef.current = false;
      emergencyExtractionTriggeredRef.current = false;

      // Configurar timeout
      clearAllTimeouts();
      timeoutRef.current = setTimeout(() => {
        if (webViewRef.current) {
          setStatusMessage('Tempo limite excedido. Tente novamente.');
          if (!emergencyExtractionTriggeredRef.current) {
            emergencyExtractionTriggeredRef.current = true;
            webViewRef.current.injectJavaScript(buildEmergencyExtractionScript());
          }
          errorDelayTimeoutRef.current = setTimeout(() => {
            if (scraperInjectedRef.current) {
              onError('Tempo limite excedido ao carregar a nota fiscal. Verifique sua conexão e tente novamente.');
            }
          }, 5000);
        }
      }, timeout);

      // Hard timeout: evita ficar travado em "Processando dados..." indefinidamente.
      absoluteTimeoutRef.current = setTimeout(() => {
        onError('Tempo limite absoluto excedido ao importar a nota fiscal.');
      }, timeout + 15000);
    } else {
      clearAllTimeouts();
    }

    return () => {
      clearAllTimeouts();
    };
  }, [visible, timeout, onError, url]);

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
        scraperInjectedRef.current = false;
        emergencyExtractionTriggeredRef.current = false;
        clearAllTimeouts();
        if (message.ok) {
          const sanitizedPayload = validateAndSanitizeNFCePayload(message.data);
          onSuccess(sanitizedPayload);
        } else {
          onError(message.error || 'Erro ao extrair dados da nota fiscal');
        }
      } else if (message.type === 'NFCE_HTML_SNAPSHOT') {
        const html = typeof message.html === 'string' ? message.html : '';
        if (!html) {
          return;
        }

        const parsed = parseRjHtml(html);
        if (!parsed || !parsed.items || parsed.items.length === 0) {
          return;
        }

        scraperInjectedRef.current = false;
        emergencyExtractionTriggeredRef.current = false;
        clearAllTimeouts();
        const sanitizedPayload = validateAndSanitizeNFCePayload(parsed);
        onSuccess(sanitizedPayload);
      }
    } catch (e) {
      if (__DEV__) {
        console.error('[NFCeWebView] Erro ao parsear mensagem:', e);
      }
      const detailedMessage = e instanceof Error ? e.message : 'Falha ao validar dados da NFC-e. Tente novamente.';
      onError(detailedMessage);
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
        scraperInjectedRef.current = true;
        injectScriptTimeoutRef.current = null;
        const hasValidAccessKey = /^\d{44}$/.test((accessKey || '').trim());
        const script = hasValidAccessKey
          ? getNfceScrapeScriptByAccessKey(accessKey)
          : getNfceScrapeScript(url);
        const wrappedScript = `window.NFCE_SCRAPE_DONE = false; ${script}`;
        webViewRef.current?.injectJavaScript(wrappedScript);

        // Alguns portais carregam conteúdo de forma tardia; reinjeta periodicamente até obter resultado.
        if (!reinjectIntervalRef.current) {
          reinjectIntervalRef.current = setInterval(() => {
            if (!webViewRef.current || !scraperInjectedRef.current) {
              return;
            }
            webViewRef.current.injectJavaScript(wrappedScript);
          }, 4000);
        }
      }, 1000);
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavState) => {
    if (navState.loading) {
      setStatusMessage('Carregando...');
    } else {
      setStatusMessage('Processando dados...');

      const currentUrl = navState.url || '';
      const isRjFinalPage = /consultadfe\.fazenda\.rj\.gov\.br/i.test(currentUrl) && /resultadoQRCode2\.faces/i.test(currentUrl);
      if (isRjFinalPage && webViewRef.current) {
        startRjFinalExtraction();
      }
    }
  };

  const handleShouldStartLoadWithRequest = (request: WebViewNavigationRequest) => {
    if (/^http:\/\//i.test(request.url)) {
      const upgradedUrl = request.url.replace(/^http:\/\//i, 'https://');
      if (__DEV__) {
        console.warn('[NFCeWebView] Upgrade HTTP->HTTPS:', request.url, '=>', upgradedUrl);
      }
      webViewRef.current?.injectJavaScript(`window.location.replace(${JSON.stringify(upgradedUrl)}); true;`);
      return false;
    }

    if (!shouldAllowNfceNavigationRequest(request)) {
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
          onError={(event) => {
            const err = event.nativeEvent;
            const message = `Erro de rede na NFC-e (${err.code}): ${err.description || 'falha ao carregar'}`;
            if (__DEV__) {
              console.warn('[NFCeWebView] onError:', err);
            }
            onError(message);
          }}
          onHttpError={(event) => {
            const err = event.nativeEvent;
            const message = `Erro HTTP ${err.statusCode} na NFC-e`;
            if (__DEV__) {
              console.warn('[NFCeWebView] onHttpError:', err);
            }
            onError(message);
          }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          userAgent={RJ_COMPAT_USER_AGENT}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          setSupportMultipleWindows={false}
          mixedContentMode="never"
          cacheEnabled={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          allowFileAccess={false}
          allowsBackForwardNavigationGestures={false}
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
