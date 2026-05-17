export const RJ_NFCE_SCRAPE_SCRIPT = `
(function () {
  const TYPE = 'NFCE_SCRAPE_RESULT';

  if (window.NFCE_SCRAPE_DONE) {
    return;
  }
  window.NFCE_SCRAPE_DONE = true;

  function post(payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (e) {
      // ultimo recurso
    }
  }

  function pickText(sel) {
    const el = document.querySelector(sel);
    const t = el ? (el.textContent || el.innerText || '').trim() : '';
    return t || null;
  }

  function normalizeMoneyBR(v) {
    if (!v) return null;
    var cleaned = v.replace(/\\./g, '').replace(',', '.').replace(/[^\\d.]/g, '');
    var num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function compactSpaces(v) {
    return (v || '').replace(/\\s+/g, ' ').trim();
  }

  function parseNumberLikeQty(v) {
    if (!v) return null;
    var cleaned = v.replace(/\\./g, '').replace(',', '.').replace(/[^\\d.]/g, '');
    var n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function findCNPJ(pageText) {
    var m = pageText.match(/\\b\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}\\b/);
    return m ? m[0] : '';
  }

  function findEmissao(pageText) {
    var m = pageText.match(/(?:Emiss[aã]o|Data\\s*de\\s*emiss[aã]o)\\s*:?\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2})/i);
    if (!m) {
      m = pageText.match(/\\b(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(\\d{2}:\\d{2}:\\d{2})\\b/);
    }
    if (!m) return '';
    return m[1] + ' ' + m[2];
  }

  function findAccessKey(pageText) {
    var compact = (pageText || '').replace(/\\s+/g, ' ');
    var keyMatch = compact.match(/(?:Chave de acesso:?\\s*)?((?:\\d{4}\\s*){11})/i);
    if (!keyMatch || !keyMatch[1]) return '';
    var digits = keyMatch[1].replace(/\\D/g, '');
    return digits.length === 44 ? digits : '';
  }

  function findTotal(pageText) {
    var totalSel = [
      '#totalNota .txtMax',
      '.totalNumb',
      '.txtMax',
      '[id*=total] .ui-outputlabel',
      '[id*=total] span'
    ];

    for (var i = 0; i < totalSel.length; i++) {
      var v = pickText(totalSel[i]);
      var n = normalizeMoneyBR(v || '');
      if (n !== null && n > 0) {
        return n;
      }
    }

    var match = pageText.match(/(?:Valor\\s*Total|Total\\s*da\\s*Nota|Total)\\s*(?:R\\$)?\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2})/i);
    if (match) {
      var n2 = normalizeMoneyBR(match[1]);
      if (n2 !== null) return n2;
    }

    return 0;
  }

  function detectItemsTable() {
    var preferred = ['#tabResult', 'table[id*=tabResult]', 'table[id*=resultado]', 'table[id*=prod]'];

    for (var i = 0; i < preferred.length; i++) {
      var t = document.querySelector(preferred[i]);
      if (t) return t;
    }

    var tables = Array.from(document.querySelectorAll('table'));
    for (var j = 0; j < tables.length; j++) {
      var text = compactSpaces(tables[j].innerText || '');
      if (!text) continue;

      if (/Descri[cç][aã]o/i.test(text) && /(Qtde|Quantidade)/i.test(text) && /(Valor|Vl\\.)/i.test(text)) {
        return tables[j];
      }
    }

    return null;
  }

  function guessItemName(cells) {
    var candidates = cells.filter(function (c) {
      return c && !/^\\d+$/.test(c) && !/^(UN|KG|L|ML|G|CX|PC)$/i.test(c) && !/^\\d{1,3}(?:\\.\\d{3})*,\\d{2}$/.test(c);
    });

    if (!candidates.length) return '';
    candidates.sort(function (a, b) {
      return b.length - a.length;
    });
    return candidates[0];
  }

  function scrapeItems() {
    var rsLikeTable = document.querySelector('#tabResult');
    if (rsLikeTable) {
      var rowsFromTabResult = Array.from(rsLikeTable.querySelectorAll('tr'));
      var parsedItems = [];

      for (var r = 0; r < rowsFromTabResult.length; r++) {
        var rowRs = rowsFromTabResult[r];
        var name = compactSpaces((rowRs.querySelector('.txtTit') || {}).textContent || '');
        if (!name) continue;

        var qtyText = compactSpaces((rowRs.querySelector('.Rqtd') || {}).textContent || '');
        var unitText = compactSpaces((rowRs.querySelector('.RUN') || {}).textContent || '');
        var unitPriceText = compactSpaces((rowRs.querySelector('.RvlUnit') || {}).textContent || '');
        var totalText = compactSpaces((rowRs.querySelector('.valor') || {}).textContent || '');

        var qtyMatch = qtyText.match(/Qtde\\.:\\s*([\\d.,]+)/i);
        var unitMatch = unitText.match(/UN:\\s*([A-Z]+)/i);
        var unitPriceMatch = unitPriceText.match(/Vl\\.\\s*Unit\\.?:\\s*([\\d.,]+)/i);

        var qty = parseNumberLikeQty(qtyMatch ? qtyMatch[1] : '') || 1;
        var unit = (unitMatch ? unitMatch[1] : 'UN').toUpperCase();
        var unitPrice = normalizeMoneyBR(unitPriceMatch ? unitPriceMatch[1] : '') || 0;
        var totalPrice = normalizeMoneyBR(totalText) || 0;

        if (!unitPrice && qty > 0 && totalPrice > 0) {
          unitPrice = totalPrice / qty;
        }

        parsedItems.push({
          name: name,
          quantity: qty,
          unit: unit,
          unityPrice: unitPrice || totalPrice || 0,
          totalPrice: totalPrice || 0,
        });
      }

      if (parsedItems.length > 0) {
        return parsedItems;
      }
    }

    var table = detectItemsTable();
    if (!table) return [];

    var rows = Array.from(table.querySelectorAll('tr'));
    var items = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var cells = Array.from(row.querySelectorAll('td')).map(function (td) {
        return compactSpaces(td.innerText || '');
      }).filter(Boolean);

      if (!cells.length) continue;

      var rowText = compactSpaces(row.innerText || '');
      if (/C[óo]digo|Descri[cç][aã]o|Qtde|Quantidade|Valor Unit[aá]rio|Valor Total/i.test(rowText) && rowText.length < 120) {
        continue;
      }

      var fallbackName = guessItemName(cells);
      if (!fallbackName || fallbackName.length < 2) continue;

      var fallbackQty = 1;
      var fallbackUnit = 'UN';
      var fallbackTotal = 0;
      var fallbackUnitPrice = 0;

      for (var c = 0; c < cells.length; c++) {
        var cur = cells[c];

        if (/^(UN|KG|L|ML|G|CX|PC)$/i.test(cur)) {
          fallbackUnit = cur.toUpperCase();
        }

        if (/^\\d{1,3}(?:,\\d{3})?$/.test(cur) || /^\\d+[,.]\\d+$/.test(cur)) {
          var q = parseNumberLikeQty(cur);
          if (q !== null && q > 0 && q < 1000) {
            fallbackQty = q;
          }
        }
      }

      var money = rowText.match(/\\b\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\b/g) || [];
      if (money.length) {
        fallbackTotal = normalizeMoneyBR(money[money.length - 1]) || 0;
        if (money.length >= 2) {
          fallbackUnitPrice = normalizeMoneyBR(money[money.length - 2]) || 0;
        }
      }

      if (!fallbackUnitPrice && fallbackQty > 0 && fallbackTotal > 0) {
        fallbackUnitPrice = fallbackTotal / fallbackQty;
      }

      items.push({
        name: fallbackName,
        quantity: fallbackQty,
        unit: fallbackUnit,
        unityPrice: fallbackUnitPrice || fallbackTotal || 0,
        totalPrice: fallbackTotal || 0,
      });
    }

    return items;
  }

  function scrapeItemsFromRawText(pageText) {
    var compact = (pageText || '').replace(/\\s+/g, ' ');
    var items = [];
    var pattern = /([A-Z0-9À-ÿ][A-Z0-9À-ÿ\\s\\-\\/\\.\\(\\),]{3,}?)\\s*\\(C[óo]digo:\\s*\\d+\\s*\\)\\s*Qtde\\.:?\\s*([\\d.,]+)\\s*UN:\\s*([A-Z]{1,5})\\s*Vl\\.\\s*Unit\\.?:\\s*([\\d.,]+)\\s*Vl\\.\\s*Total\\s*([\\d.,]+)/gi;
    var match;

    while ((match = pattern.exec(compact)) !== null) {
      var name = compactSpaces(match[1] || '');
      var qty = parseNumberLikeQty(match[2] || '') || 1;
      var unit = (match[3] || 'UN').toUpperCase();
      var unitPrice = normalizeMoneyBR(match[4] || '') || 0;
      var totalPrice = normalizeMoneyBR(match[5] || '') || 0;

      if (!unitPrice && qty > 0 && totalPrice > 0) {
        unitPrice = totalPrice / qty;
      }

      if (name) {
        items.push({
          name: name,
          quantity: qty,
          unit: unit,
          unityPrice: unitPrice || totalPrice || 0,
          totalPrice: totalPrice || 0,
        });
      }
    }

    return items;
  }

  function findStoreName(pageText) {
    var selectors = [
      '#u20',
      '.txtTopo',
      '.identificacao .txtTopo',
      '[id*=emitente] .txtTopo',
      '[id*=emitente] span',
      'h1',
      'h2',
      'h3'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var value = pickText(selectors[i]);
      if (value && value.length > 2 && !/consulta|nfce/i.test(value)) {
        return value;
      }
    }

    var line = (pageText.split(/\\n+/).map(function (l) { return compactSpaces(l); }).find(function (l) {
      return l.length > 5 && !/consulta|chave|protocolo|emiss[aã]o|valor total|total da nota/i.test(l) && !/^\\d{2}\\.\\d{3}\\.\\d{3}\\/\\d{4}-\\d{2}$/.test(l);
    })) || '';

    return line || 'Estabelecimento';
  }

  function findCityState(pageText) {
    var match = pageText.match(/([A-Za-zÀ-ÿ\\s]+)\\s*-\\s*(RJ|[A-Z]{2})\\b/);
    if (!match) {
      return { city: '', state: 'RJ' };
    }

    return {
      city: compactSpaces(match[1] || ''),
      state: (match[2] || 'RJ').toUpperCase(),
    };
  }

  function main() {
    var startedAt = Date.now();
    var maxWaitMs = 12000;

    var checkInterval = setInterval(function () {
      var href = (window.location && window.location.href) ? window.location.href : '';
      var isFinalPage = /resultadoQRCode2\\.faces/i.test(href);
      var hasStore = !!document.querySelector('#u20, .txtTopo, h1, h2, h3');
      var hasItems = !!detectItemsTable();
      var hasTotal = !!document.querySelector('#totalNota .txtMax, .totalNumb, [id*=total] span');
      var hasItemRows = !!document.querySelector('#tabResult tr[id^="Item"]');

      // Só extrai quando estiver na página final e com sinais reais de conteúdo.
      if ((isFinalPage && (hasItemRows || (hasStore && hasItems) || (hasItems && hasTotal))) || Date.now() - startedAt >= maxWaitMs) {
        clearInterval(checkInterval);
        doScrape();
      }
    }, 250);
  }

  function doScrape() {
    try {
      var pageText = (document.body && (document.body.innerText || document.body.textContent) || '').trim();

      var blockedByIp = /endere[cç]os?\\s+ip|bloqueio|sigilo fiscal|ouberj/i.test(pageText);
      if (blockedByIp) {
        post({
          type: TYPE,
          ok: false,
          error: 'A SEFAZ-RJ bloqueou este acesso por IP. Tente novamente em outra rede.'
        });
        return;
      }

      var storeName = findStoreName(pageText);
      var cnpj = findCNPJ(pageText);
      var emittedAt = findEmissao(pageText);
      var accessKey = findAccessKey(pageText);
      var total = findTotal(pageText);
      var cityState = findCityState(pageText);
      var items = scrapeItems();
      if (!items.length) {
        items = scrapeItemsFromRawText(pageText);
      }

      if (!items.length) {
        post({
          type: TYPE,
          ok: false,
          error: 'Nao foi possivel extrair itens da NFC-e do RJ.'
        });
        return;
      }

      post({
        type: TYPE,
        ok: true,
        data: {
          storeName: storeName || 'Estabelecimento',
          cnpj: cnpj || '',
          accessKey: accessKey || '',
          city: cityState.city || '',
          state: cityState.state || 'RJ',
          emittedAt: emittedAt || '',
          total: total || 0,
          items: items
        }
      });
    } catch (err) {
      post({
        type: TYPE,
        ok: false,
        error: 'Erro ao executar scraper da NFC-e do RJ.'
      });
    }
  }

  try {
    main();
  } catch (err) {
    post({
      type: TYPE,
      ok: false,
      error: 'Erro ao executar scraper da NFC-e do RJ.'
    });
  }
})();
`;
