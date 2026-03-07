export const NFCE_SCRAPE_SCRIPT = `
(function () {
  const TYPE = 'NFCE_SCRAPE_RESULT';

  // Evitar execucoes multiplas
  if (window.NFCE_SCRAPE_DONE) {
    return;
  }
  window.NFCE_SCRAPE_DONE = true;

  function post(payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (e) {
      // ultimo recurso: nada
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
    // tenta "Emissao: 04/07/2025 17:07:11" e variacoes
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

      // muitas tabelas tem cabecalho; filtra por heuristica
      if (/^Item\\s*$/i.test(text)) continue;
      if (/C[óo]digo|Descri[cç][aã]o|Qtde|Un|Vl/i.test(text) && text.length < 80) {
        // provavel header
        continue;
      }

      // Pegar celulas da tabela
      var cells = Array.from(row.querySelectorAll('td')).map(function(td) { return (td.innerText || '').trim(); }).filter(Boolean);

      var name = null, qty = 1, unit = null, unitPrice = null, total = null;

      // Layout tipico da NFC-e SEFAZ-RS:
      // [Item] [Codigo] [Descricao] [Qtde] [Unidade] [Valor Unitario] [Valor Total]
      // Exemplo: "1" "38281" "REFRIGERANTE LATA 350ML" "1,000" "UN" "7,50" "7,50"

      if (cells.length >= 4) {
        // Tentar extrair quantidade: geralmente e um numero com 3-4 digitos decimais (ex: 1,000, 0,500)
        // Procura por padrao numerico que parece quantidade: 1,000 / 0,500 / 2,000 / 10,000
        var qtyMatch = text.match(/\\b(\\d{1,3})(?:[,.](\\d{1,3}))?\\b/);

        // Se encontrou celulas, usar a posicao delas para identificar os campos
        // cells[0] = item number, cells[1] = code, cells[2] = name, cells[3] = qty, cells[4] = unit, cells[5] = unit price, cells[6] = total

        if (cells.length >= 7) {
          // Tentativa: cells[3] e quantidade (ou cells[0] se for so item numero)
          // Procura o primeiro numero que tem formato de quantidade (ex: "1,000")
          for (var c = 0; c < cells.length; c++) {
            var cellText = cells[c];
            // Quantidade geralmente tem formato: 1,000 ou 0,500 ou 10,000
            if (/^\\d{1,3}(?:,\\d{3})?$/.test(cellText) || /^\\d{1,3}\\.\\d{3}$/.test(cellText)) {
              var q = normalizeMoneyBR(cellText);
              if (q !== null && q > 0 && q < 1000) {
                qty = q;
                // Proxima celula pode ser a unidade
                if (c + 1 < cells.length && /^(UN|KG|L|ML|G|PC|CX)$/i.test(cells[c + 1])) {
                  unit = cells[c + 1].toUpperCase();
                }
                break;
              }
            }
          }

          // Nome e tipicament a celula mais longa que nao e numero
          var nonNumberCells = cells.filter(function(c) { return !/^\\d{1,3}(?:[,.]\\d{1,3})?$/.test(c) && !/^\\d{1,3}(?:\\.\\d{3})*,\\d{2}$/.test(c); });
          if (nonNumberCells.length > 0) {
            name = nonNumberCells.sort(function(a,b) { return b.length - a.length; })[0];
          }

          // Usar sempre total / quantidade para calcular preco unitario
          var moneyMatches = text.match(/\\b\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\b/g) || [];
          if (moneyMatches.length >= 1) {
            total = normalizeMoneyBR(moneyMatches[moneyMatches.length - 1]);
            unitPrice = total / (qty || 1);
          }
        } else if (cells.length >= 2) {
          // Fallback: nome = celula mais longa
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

      // so adiciona se parecer item
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

      // validacao minima
      if (!storeName && !items.length && total == null) {
        post({
          type: TYPE,
          ok: false,
          error: 'Nao foi possivel extrair dados da NFC-e (estrutura inesperada).'
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
