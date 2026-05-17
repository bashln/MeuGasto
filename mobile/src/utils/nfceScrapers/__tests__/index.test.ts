import { getNfceScrapeScript, getNfceScrapeScriptByAccessKey, NFCE_SCRAPE_SCRIPT } from '../index';

describe('nfceScrapers registry', () => {
  it('retorna scraper RS quando cUF=43', () => {
    const script = getNfceScrapeScript(
      'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43180611111111111111111111111111111111111111|2|1|1|HASH'
    );

    expect(script).toContain('NFCE_SCRAPE_RESULT');
    expect(script).toContain('#tabResult');
  });

  it('retorna scraper RJ quando cUF=33', () => {
    const script = getNfceScrapeScript(
      'https://consultadfe.fazenda.rj.gov.br/consultaNFCe/paginas/resultadoQRCode2.faces?cid=1&p=33180611111111111111111111111111111111111111'
    );

    expect(script).toContain('NFC-e do RJ');
    expect(script).toContain("state: 'RJ'");
  });

  it('faz fallback para RS quando UF ainda nao possui estrategia dedicada', () => {
    const script = getNfceScrapeScript(
      'https://www.sefaznet.ac.gov.br/nfce/qrcode?p=12180611111111111111111111111111111111111111'
    );

    expect(script).toBe(NFCE_SCRAPE_SCRIPT);
  });

  it('faz fallback para RS quando URL nao permite extrair cUF', () => {
    const script = getNfceScrapeScript('https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx');
    expect(script).toBe(NFCE_SCRAPE_SCRIPT);
  });

  it('seleciona scraper por cUF usando access key (sem depender de URL)', () => {
    const rsScript = getNfceScrapeScriptByAccessKey('43180611111111111111111111111111111111111111');
    const rjScript = getNfceScrapeScriptByAccessKey('33180611111111111111111111111111111111111111');

    expect(rsScript).toContain('#tabResult');
    expect(rjScript).toContain("state: 'RJ'");
  });
});
