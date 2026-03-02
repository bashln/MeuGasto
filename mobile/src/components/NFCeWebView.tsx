import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator, Text, Button } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme/colors';
import { NFCE_ALLOWED_HOSTS } from '../services/nfceService';

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

const SCRAPE_SCRIPT = `
(function () {
  const TYPE = 'NFCE_SCRAPE_RESULT';

  // Evitar execuções múltiplas
  if (window.NFCE_SCRAPE_DONE) {
    return;
  }
  window.NFCE_SCRAPE_DONE = true;

  function post(payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (e) {
      // último recurso: nada
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function pickText(sel) {
    const el = document.querySelector(sel);
    const t = el ? (el.textContent || el.innerText || '').trim() : '';
    return t || null;
  }

  function normalizeMoneyBR(v) {
    if (!v) return null;
    // "150,50" -> 150.50
    var cleaned = v.replace(/\\./g, '').replace(',', '.').replace(/[^\\d.]/g, '');
    var num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function findCNPJ(pageText) {
    // aceita "03.107.202/0017-92" em qualquer lugar
    var m = pageText.match(/\\b\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}\\b/);
    return m ? m[0] : null;
  }

  function findEmissao(pageText) {
    // tenta "Emissão: 04/07/2025 17:07:11" e variações
    var m = pageText.match(/Emiss[aã]o:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2})/i);
    if (!m) {
      m = pageText.match(/\\b(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2})\\b/);
    }
    if (!m) return null;
    return m[1] + ' ' + m[2];
  }

  function scrapeItems() {
    var rows = Array.from(document.querySelectorAll('#tabResult tr'));
    var items = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var text = (row.innerText || '').replace(/\\s+\\n/g, '\\n').trim();
      if (!text) continue;

      // muitas tabelas têm cabeçalho; filtra por heurística
      if (/^Item\\s*$/i.test(text)) continue;
      if (/C[óo]digo|Descri[cç][aã]o|Qtde|Un|Vl/i.test(text) && text.length < 80) {
        // provável header
        continue;
      }

      // Pegar células da tabela
      var cells = Array.from(row.querySelectorAll('td')).map(function(td) { return (td.innerText || '').trim(); }).filter(Boolean);

      var name = null, qty = 1, unit = null, unitPrice = null, total = null;

      // Layout típico da NFC-e SEFAZ-RS:
      // [Item] [Código] [Descrição] [Qtde] [Unidade] [Valor Unitário] [Valor Total]
      // Exemplo: "1" "38281" "REFRIGERANTE LATA 350ML" "1,000" "UN" "7,50" "7,50"
      
      if (cells.length >= 4) {
        // Tentar extrair quantidade: geralmente é um número com 3-4 dígitos decimais (ex: 1,000, 0,500)
        //Procura por padrão numérico que parece quantidade: 1,000 / 0,500 / 2,000 / 10,000
        var qtyMatch = text.match(/\\b(\\d{1,3})(?:[,.](\\d{1,3}))?\\b/);
        
        // Se encontrou células, usar它们的位置来识别
        //cells[0] = item number, cells[1] = code, cells[2] = name, cells[3] = qty, cells[4] = unit, cells[5] = unit price, cells[6] = total
        
        if (cells.length >= 7) {
          // Tentativa: cells[3] é quantidade (ou cells[0] se for só item número)
          // Procura o primeiro número que tem formato de quantidade (ex: "1,000")
          for (var c = 0; c < cells.length; c++) {
            var cellText = cells[c];
            // Quantidade geralmente tem formato: 1,000 ou 0,500 ou 10,000
            if (/^\\d{1,3}(?:,\\d{3})?$/.test(cellText) || /^\\d{1,3}\\.\\d{3}$/.test(cellText)) {
              var q = normalizeMoneyBR(cellText);
              if (q !== null && q > 0 && q < 1000) {
                qty = q;
                // Próxima célula pode ser a unidade
                if (c + 1 < cells.length && /^(UN|KG|L|ML|G|PC|CX)$/i.test(cells[c + 1])) {
                  unit = cells[c + 1].toUpperCase();
                }
                break;
              }
            }
          }
          
          // Nome é típicament a célula mais longa que não é número
          var nonNumberCells = cells.filter(function(c) { return !/^\\d{1,3}(?:[,.]\\d{1,3})?$/.test(c) && !/^\\d{1,3}(?:\\.\\d{3})*,\\d{2}$/.test(c); });
          if (nonNumberCells.length > 0) {
            name = nonNumberCells.sort(function(a,b) { return b.length - a.length; })[0];
          }
          
          // Preços: último valor monetário é o total, o penúltimo é o unitário
          var moneyMatches = text.match(/\\b\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\b/g) || [];
          if (moneyMatches.length >= 2) {
            total = normalizeMoneyBR(moneyMatches[moneyMatches.length - 1]);
            unitPrice = normalizeMoneyBR(moneyMatches[moneyMatches.length - 2]);
          } else if (moneyMatches.length === 1) {
            total = normalizeMoneyBR(moneyMatches[0]);
            unitPrice = total / qty;
          }
        } else if (cells.length >= 2) {
          // Fallback: nome = célula mais longa
          name = cells.sort(function(a,b) { return b.length - a.length; })[0];
          
          // Dinheiro
          var moneyMatches2 = text.match(/\\b\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\b/g) || [];
          if (moneyMatches2.length) total = normalizeMoneyBR(moneyMatches2[moneyMatches2.length - 1]);
        }
      } else {
        // fallback: nome = primeira linha
        var firstLine = text.split('\\n')[0];
        name = firstLine ? firstLine.trim() : null;

        var moneyMatches3 = text.match(/\\b\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\b/g) || [];
        if (moneyMatches3.length) total = normalizeMoneyBR(moneyMatches3[moneyMatches3.length - 1]);
      }

      // só adiciona se parecer item
      if (name && name.length >= 2) {
        items.push({
          name: name,
          quantity: qty || 1,
          unit: unit || 'UN',
          unityPrice: unitPrice || total || 0,
          totalPrice: total || 0
        });
      }
    }

    return items;
  }

  function main() {
    var startedAt = Date.now();
    var maxWaitMs = 12000;

    // espera DOM ter sinais de que carregou
    var checkInterval = setInterval(function() {
      var hasStore = !!document.querySelector('#u20, .txtTopo');
      var hasItems = !!document.querySelector('#tabResult');
      var hasTotal = !!document.querySelector('#totalNota .txtMax');
      if (hasStore || hasItems || hasTotal || Date.now() - startedAt >= maxWaitMs) {
        clearInterval(checkInterval);
        doScrape();
      }
    }, 250);
  }

  function doScrape() {
    try {
      var pageText = (document.body && (document.body.innerText || document.body.textContent) || '').trim();

      var storeName = pickText('#u20') || pickText('.txtTopo');
      var totalText = pickText('#totalNota .txtMax');
      var total = normalizeMoneyBR(totalText);

      var cnpj = findCNPJ(pageText);
      var emittedAt = findEmissao(pageText);

      // Tentar extrair cidade e estado
      var cityStateMatch = pageText.match(/([A-Za-zÀ-ÿ\\s]+)\\s*-\\s*([A-Z]{2})/);
      var city = cityStateMatch ? cityStateMatch[1].trim() : null;
      var state = cityStateMatch ? cityStateMatch[2] : null;

      var items = scrapeItems();

      // validação mínima
      if (!storeName && !items.length && total == null) {
        post({
          type: TYPE,
          ok: false,
          error: 'Não foi possível extrair dados da NFC-e (estrutura inesperada).'
        });
        return;
      }

      post({
        type: TYPE,
        ok: true,
        data: {
          storeName: storeName || 'Estabelecimento',
          cnpj: cnpj || '',
          city: city || '',
          state: state || '',
          emittedAt: emittedAt || '',
          total: total || 0,
          items: items
        }
      });
    } catch (err) {
      post({
        type: TYPE,
        ok: false,
        error: 'Erro ao executar scraper da NFC-e.'
      });
    }
  }

  try {
    main();
  } catch (err) {
    post({
      type: TYPE,
      ok: false,
      error: 'Erro ao executar scraper da NFC-e.'
    });
  }
})();
`;

export const NFCeWebView: React.FC<NFCeWebViewProps> = ({
  visible,
  url,
  onSuccess,
  onError,
  onCancel,
  timeout = 30000,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Isso pode levar alguns segundos.');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAllowedNavigation = (targetUrl?: string): boolean => {
    if (!targetUrl) return false;
    if (targetUrl === 'about:blank') return true;

    try {
      const parsed = new URL(targetUrl);
      return NFCE_ALLOWED_HOSTS.has(parsed.hostname);
    } catch (_error) {
      return false;
    }
  };

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setStatusMessage('Isso pode levar alguns segundos.');
      
      // Configurar timeout
      timeoutRef.current = setTimeout(() => {
        if (webViewRef.current) {
          setStatusMessage('Tempo limite excedido. Tente novamente.');
          setTimeout(() => {
            onError('Tempo limite excedido ao carregar a nota fiscal. Verifique sua conexão e tente novamente.');
          }, 2000);
        }
      }, timeout);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, timeout]);

  const handleMessage = (event: { nativeEvent: { data?: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data ?? '{}');
      
      if (DEBUG) {
        console.log('[NFCeWebView] Mensagem recebida:', message.type);
      }

      if (message.type === 'NFCE_DEBUG' && DEBUG) {
        console.log('[NFCeWebView] Debug:', message.message);
        setStatusMessage(message.message);
      } else if (message.type === 'NFCE_SCRAPE_RESULT') {
        if (message.ok) {
          setLoading(false);
          onSuccess(message.data);
        } else {
          setLoading(false);
          onError(message.error || 'Erro ao extrair dados da nota fiscal');
        }
      }
    } catch (e) {
      console.error('[NFCeWebView] Erro ao parsear mensagem:', e);
    }
  };

  const handleLoadEnd = () => {
    setLoading(false);
    setStatusMessage('Extraindo dados da nota...');
    
    // Injetar script após carregamento
    if (webViewRef.current) {
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(SCRAPE_SCRIPT);
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
