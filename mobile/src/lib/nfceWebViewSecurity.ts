const MESSAGE_NONCE_FIELD = '__meuGastoNonce';
const NONCE_BYTE_LENGTH = 16;

type NfceMessageEnvelope = Record<string, unknown>;

export const createNfceMessageNonce = (): string => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Gerador seguro indisponivel para importar NFC-e.');
  }

  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  cryptoApi.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const hasValidNfceMessageNonce = (
  message: unknown,
  expectedNonce: string
): message is NfceMessageEnvelope => {
  if (!expectedNonce || !message || typeof message !== 'object' || Array.isArray(message)) {
    return false;
  }

  return (message as NfceMessageEnvelope)[MESSAGE_NONCE_FIELD] === expectedNonce;
};

export const isNfceMessageSourceForImport = (sourceUrl: string, importUrl: string): boolean => {
  try {
    const source = new URL(sourceUrl);
    const expected = new URL(importUrl);

    return source.protocol === 'https:' && source.origin === expected.origin;
  } catch {
    return false;
  }
};

export const validateNfceAccessKeyMatch = (
  scrapedAccessKey: string | undefined,
  expectedAccessKey: string
): void => {
  const scraped = (scrapedAccessKey || '').trim();
  const expected = (expectedAccessKey || '').trim();

  if (scraped && expected && scraped !== expected) {
    throw new Error('A chave extraída não corresponde ao QR Code escaneado.');
  }
};

export const createNfceMessageBridgeBootstrap = (nonce: string): string => `
  (function () {
    if (window.top !== window.self) return;

    var bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== 'function') return;

    if (!bridge.__meuGastoOriginalPostMessage) {
      bridge.__meuGastoOriginalPostMessage = bridge.postMessage.bind(bridge);
    }

    bridge.__meuGastoCurrentNonce = ${JSON.stringify(nonce)};
    bridge.postMessage = function (rawMessage) {
      try {
        var parsedMessage = JSON.parse(rawMessage);
        if (parsedMessage && typeof parsedMessage === 'object' && !Array.isArray(parsedMessage)) {
          parsedMessage.${MESSAGE_NONCE_FIELD} = bridge.__meuGastoCurrentNonce;
          bridge.__meuGastoOriginalPostMessage(JSON.stringify(parsedMessage));
          return;
        }
      } catch (_) {}

      bridge.__meuGastoOriginalPostMessage(rawMessage);
    };
  })();
  true;
`;
