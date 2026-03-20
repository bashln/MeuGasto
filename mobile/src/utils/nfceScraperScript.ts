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

  function normalizeCellText(v) {
    return (v || '').replace(/\\s+/g, ' ').trim();
  }

  function parseMoneyCell(v) {
    var normalized = normalizeCellText(v);
    if (!normalized || !/^\\d{1,3}(?:\\.\\d{3})*,\\d{2}$/.test(normalized)) {
      return null;
    }
    return normalizeMoneyBR(normalized);
  }

  function parseQuantityCell(v) {
    var normalized = normalizeCellText(v);
    if (!normalized || !/^\\d{1,5}(?:[,.]\\d{1,3})?$/.test(normalized)) {
      return null;
    }
    var parsed = normalizeMoneyBR(normalized);
    return parsed !== null && parsed > 0 && parsed < 100000 ? parsed : null;
  }

  function isUnitCell(v) {
    var normalized = normalizeCellText(v).toUpperCase();
    return /^(UN|UND|UNID|KG|G|GR|L|LT|ML|CX|PC|PCT|FD|DZ|SC|PT|FRD)$/.test(normalized) || /^[A-Z]{1,4}$/.test(normalized);
  }

  function findItemName(cells, stopIndex) {
    var candidates = cells
      .slice(0, stopIndex > 0 ? stopIndex : cells.length)
      .map(normalizeCellText)
      .filter(function(cell) {
        return cell &&
          !isUnitCell(cell) &&
          parseQuantityCell(cell) === null &&
          parseMoneyCell(cell) === null &&
          !/^\\d+$/.test(cell);
      });

    if (!candidates.length) {
      candidates = cells
        .map(normalizeCellText)
        .filter(function(cell) {
          return cell &&
            !isUnitCell(cell) &&
            parseQuantityCell(cell) === null &&
            parseMoneyCell(cell) === null &&
            !/^\\d+$/.test(cell);
        });
    }

    return candidates.length
      ? candidates.sort(function(a, b) { return b.length - a.length; })[0]
      : null;
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
      if (/^(Item|C[óo]digo|Descri[cç][aã]o|Qtde|Un|Vl)/i.test(text) && text.length < 80) {
        // provavel header
        continue;
      }

      // Pegar celulas da tabela
      var cells = Array.from(row.querySelectorAll('td'))
        .map(function(td) { return normalizeCellText(td.innerText || ''); })
        .filter(Boolean);

      var name = null, qty = 1, unit = null, unitPrice = null, total = null;

      // Layout tipico da NFC-e SEFAZ-RS:
      // [Item] [Codigo] [Descricao] [Qtde] [Unidade] [Valor Unitario] [Valor Total]
      // Exemplo: "1" "38281" "REFRIGERANTE LATA 350ML" "1,000" "UN" "7,50" "7,50"

      if (cells.length >= 4) {
        // Procura o par [quantidade, unidade] seguido de valores monetarios.
        // Isso evita confundir o numero ordinal do item ("1") com a quantidade real ("5,000").
        var qtyIndex = -1;

        for (var c = 0; c < cells.length - 1; c++) {
          var parsedQty = parseQuantityCell(cells[c]);
          if (parsedQty === null || !isUnitCell(cells[c + 1])) {
            continue;
          }

          var trailingMoneyValues = cells
            .slice(c + 2)
            .map(parseMoneyCell)
            .filter(function(value) { return value !== null; });

          if (!trailingMoneyValues.length) {
            continue;
          }

          qty = parsedQty;
          qtyIndex = c;
          unit = cells[c + 1].toUpperCase();

          if (trailingMoneyValues.length >= 2) {
            unitPrice = trailingMoneyValues[0];
            total = trailingMoneyValues[trailingMoneyValues.length - 1];
          } else {
            total = trailingMoneyValues[0];
            unitPrice = qty > 0 ? total / qty : trailingMoneyValues[0];
          }

          break;
        }

        name = findItemName(cells, qtyIndex);

        if (unitPrice === null || total === null) {
          var moneyValues = cells
            .map(parseMoneyCell)
            .filter(function(value) { return value !== null; });

          if (moneyValues.length >= 2) {
            if (unitPrice === null) unitPrice = moneyValues[moneyValues.length - 2];
            if (total === null) total = moneyValues[moneyValues.length - 1];
          } else if (moneyValues.length === 1) {
            if (total === null) total = moneyValues[0];
            if (unitPrice === null) unitPrice = qty > 0 ? moneyValues[0] / qty : moneyValues[0];
          }
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
