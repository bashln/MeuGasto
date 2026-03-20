import { NFCE_SCRAPE_SCRIPT } from '../nfceScraperScript';

describe('nfceScraperScript', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exporta script com canal de retorno esperado', () => {
    expect(NFCE_SCRAPE_SCRIPT).toContain('NFCE_SCRAPE_RESULT');
    expect(NFCE_SCRAPE_SCRIPT).toContain('window.ReactNativeWebView.postMessage');
  });

  it('extrai quantidade real e preco unitario a partir das colunas da NFC-e', () => {
    const postMessage = jest.fn();
    const rowCells = [
      '1',
      '1570',
      'CERVEJA PROIBIDA 473ML PILSEN (Código: 1570 )',
      '5,000',
      'UN',
      '3,19',
      '15,95',
    ];

    const documentMock = {
      body: {
        innerText: 'Mercearia Exemplo 06/03/2026 17:31:00',
        textContent: 'Mercearia Exemplo 06/03/2026 17:31:00',
      },
      querySelector: jest.fn((selector: string) => {
        if (selector === '#u20') return { textContent: 'Mercearia Exemplo' };
        if (selector === '#totalNota .txtMax') return { textContent: '15,95' };
        if (selector === '#tabResult') return {};
        return null;
      }),
      querySelectorAll: jest.fn((selector: string) => {
        if (selector !== '#tabResult tr') {
          return [];
        }

        return [
          {
            innerText: rowCells.join('\n'),
            querySelectorAll: jest.fn((cellSelector: string) => {
              if (cellSelector !== 'td') {
                return [];
              }
              return rowCells.map((value) => ({ innerText: value }));
            }),
          },
        ];
      }),
    };

    const executeScript = new Function(
      'window',
      'document',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      NFCE_SCRAPE_SCRIPT,
    );

    executeScript(
      { ReactNativeWebView: { postMessage } },
      documentMock,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
    );

    jest.advanceTimersByTime(300);

    expect(postMessage).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(postMessage.mock.calls[0][0]);
    expect(payload).toMatchObject({
      type: 'NFCE_SCRAPE_RESULT',
      ok: true,
      data: {
        storeName: 'Mercearia Exemplo',
      },
    });
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]).toMatchObject({
      name: 'CERVEJA PROIBIDA 473ML PILSEN (Código: 1570 )',
      quantity: 5,
      unit: 'UN',
      unityPrice: 3.19,
      totalPrice: 15.95,
    });
  });
});
