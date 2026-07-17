import {
  createNfceMessageNonce,
  createNfceMessageBridgeBootstrap,
  hasValidNfceMessageNonce,
  isNfceMessageSourceForImport,
  validateNfceAccessKeyMatch,
} from '../nfceWebViewSecurity';

describe('nfceWebViewSecurity', () => {
  it('aceita somente mensagens vinculadas a importacao atual', () => {
    expect(hasValidNfceMessageNonce({ __meuGastoNonce: 'nonce-atual' }, 'nonce-atual')).toBe(true);
    expect(hasValidNfceMessageNonce({ __meuGastoNonce: 'nonce-antigo' }, 'nonce-atual')).toBe(
      false
    );
    expect(hasValidNfceMessageNonce({}, 'nonce-atual')).toBe(false);
  });

  it('adiciona o nonce a mensagens enviadas pelo script injetado', () => {
    const sentMessages: string[] = [];
    const windowObject = {
      ReactNativeWebView: {
        postMessage: (message: string) => sentMessages.push(message),
      },
    };

    const bootstrap = createNfceMessageBridgeBootstrap('nonce-atual');
    Function('window', bootstrap)(windowObject);

    windowObject.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NFCE_SCRAPE_RESULT' }));

    expect(JSON.parse(sentMessages[0])).toEqual({
      type: 'NFCE_SCRAPE_RESULT',
      __meuGastoNonce: 'nonce-atual',
    });
  });

  it('gera nonces distintos para importacoes diferentes', () => {
    const first = createNfceMessageNonce();
    const second = createNfceMessageNonce();

    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).toMatch(/^[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
  });

  it('aceita mensagens apenas da origem da importacao atual', () => {
    const importUrl = 'https://nfce.sefaz.rs.gov.br/consulta?p=123';

    expect(
      isNfceMessageSourceForImport(
        'https://nfce.sefaz.rs.gov.br/consulta/resultado?token=abc',
        importUrl
      )
    ).toBe(true);
    expect(
      isNfceMessageSourceForImport(
        'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/paginas/resultado.faces',
        importUrl
      )
    ).toBe(false);
    expect(isNfceMessageSourceForImport('not-a-url', importUrl)).toBe(false);
  });

  it('rejeita uma nota cuja chave difere do QR Code escaneado', () => {
    expect(() => validateNfceAccessKeyMatch('1'.repeat(44), '1'.repeat(44))).not.toThrow();
    expect(() => validateNfceAccessKeyMatch('', '1'.repeat(44))).not.toThrow();
    expect(() => validateNfceAccessKeyMatch('2'.repeat(44), '1'.repeat(44))).toThrow(
      'não corresponde'
    );
  });
});
