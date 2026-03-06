import { NFCE_SCRAPE_SCRIPT } from '../nfceScraperScript';

describe('nfceScraperScript', () => {
  it('exporta script com canal de retorno esperado', () => {
    expect(NFCE_SCRAPE_SCRIPT).toContain('NFCE_SCRAPE_RESULT');
    expect(NFCE_SCRAPE_SCRIPT).toContain('window.ReactNativeWebView.postMessage');
  });
});
