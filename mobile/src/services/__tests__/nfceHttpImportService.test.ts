import { nfceHttpImportService, parseRjHtml } from '../nfceHttpImportService';

describe('nfceHttpImportService parseRjHtml', () => {
  it('extrai itens e totais de HTML no formato RJ', () => {
    const html = `
      <div id="u20" class="txtTopo">DOM ATACAREJO SA</div>
      <div>CNPJ: 31.698.759/0015-19</div>
      <table id="tabResult">
        <tr id="Item + 1">
          <td>
            <span class="txtTit">BISC RECH PASSATEMPO 130G CHOC</span>
            <span class="Rqtd"><strong>Qtde.:</strong>2</span>
            <span class="RUN"><strong>UN: </strong>PT</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong> 2,49</span>
          </td>
          <td><span class="valor">4,98</span></td>
        </tr>
        <tr id="Item + 2">
          <td>
            <span class="txtTit">SACOLA PLASTICA</span>
            <span class="Rqtd"><strong>Qtde.:</strong>1</span>
            <span class="RUN"><strong>UN: </strong>UN</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong> 0,18</span>
          </td>
          <td><span class="valor">0,18</span></td>
        </tr>
      </table>
      <div id="totalNota">
        <span class="totalNumb txtMax">95,99</span>
      </div>
      <div>
        <strong>Chave de acesso:</strong>
        <span class="chave">3326 0531 6987 5900 1519 6512 4000 0285 2318 9293 1973</span>
      </div>
      <strong>Emissão: </strong>15/05/2026 19:08:04-03:00 - Via Consumidor 2
    `;

    const parsed = parseRjHtml(html);
    expect(parsed).not.toBeNull();
    expect(parsed?.storeName).toBe('DOM ATACAREJO SA');
    expect(parsed?.cnpj).toBe('31.698.759/0015-19');
    expect(parsed?.state).toBe('RJ');
    expect(parsed?.total).toBeCloseTo(95.99, 2);
    expect(parsed?.items).toHaveLength(2);
      expect(parsed?.items[0].name).toContain('PASSATEMPO');
      expect(parsed?.accessKey).toBe('33260531698759001519651240000285231892931973');
      // "Emissão" com acento (variante RJ) continua aceita
      expect(parsed?.emittedAt).toContain('15/05/2026');
  });

  it('extrai itens e totais de HTML no formato RS (dfe-portal.svrs)', () => {
    const html = `
      <div id="u20" class="txtTopo">Mercearia J O L I Ltda</div>
      <div>CNPJ: 04.784.082/0001-63</div>
      <table id="tabResult">
        <tr id="Item + 1">
          <td>
            <span class="txtTit">ENERGETICO BALY 473ML ABACAXI/ HORTELA (Codigo: 32798 )</span>
            <span class="Rqtd"><strong>Qtde.:</strong>1</span>
            <span class="RUN"><strong>UN: </strong>UN</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong>8,99</span>
          </td>
          <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br /><span class="valor">8,99</span></td>
        </tr>
        <tr id="Item + 2">
          <td>
            <span class="txtTit">QUEIJO LANCHE STA HELENA KG (Codigo: 105 )</span>
            <span class="Rqtd"><strong>Qtde.:</strong>0,124</span>
            <span class="RUN"><strong>UN: </strong>KG</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong>54,9</span>
          </td>
          <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br /><span class="valor">6,81</span></td>
        </tr>
      </table>
      <div id="totalNota">
        <div id="linhaTotal" class="linhaShade"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">81,74</span></div>
      </div>
      <div><span class="chave">4326 0904 7840 8200 0163 6520 4000 1781 6711 4551 9190</span></div>
      <strong> Emissao: </strong>18/09/2026 18:24:51 - Via Consumidor 2
    `;

    const parsed = parseRjHtml(html);
    expect(parsed).not.toBeNull();
    expect(parsed?.storeName).toBe('Mercearia J O L I Ltda');
    expect(parsed?.total).toBeCloseTo(81.74, 2);
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0].name).toContain('ENERGETICO BALY');
    expect(parsed?.items[1].quantity).toBeCloseTo(0.124, 3);
    expect(parsed?.items[1].unit).toBe('KG');
    expect(parsed?.accessKey).toBe('43260904784082000163652040001781671145519190');
    // "Emissao" sem acento (variante SVRS) deve ser aceita — senao compra antiga
    // cai na data de hoje (createPurchaseFromScrapedData usa new Date() como fallback)
    expect(parsed?.emittedAt).toContain('18/09/2026');
  });
});

describe('nfceHttpImportService.tryImport', () => {
  const RS_URL =
    'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260904784082000163652040001781671145519190|2|1|1|A274DF310A01C053663AF39A5A94F59CBF44B5A7';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('suporta GET-first para o portal RS (svrs) e deriva state pela chave', async () => {
    const html = `
      <div id="u20" class="txtTopo">Mercearia J O L I Ltda</div>
      <table id="tabResult">
        <tr id="Item + 1">
          <td>
            <span class="txtTit">ARROZ MULTIMERCADOS 1KG PARB</span>
            <span class="Rqtd"><strong>Qtde.:</strong>1</span>
            <span class="RUN"><strong>UN: </strong>UN</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong>5,49</span>
          </td>
          <td><span class="valor">5,49</span></td>
        </tr>
      </table>
      <div id="totalNota"><span class="totalNumb txtMax">81,74</span></div>
      <div><span class="chave">4326 0904 7840 8200 0163 6520 4000 1781 6711 4551 9190</span></div>
      <strong> Emissao: </strong>18/09/2026 18:24:51
    `;
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    );

    const result = await nfceHttpImportService.tryImport(RS_URL);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.state).toBe('RS');
      expect(result.data.items).toHaveLength(1);
      expect(result.accessKey).toBe('43260904784082000163652040001781671145519190');
      expect(result.data.emittedAt).toContain('18/09/2026');
    }
  });

  it('ainda bloqueia hosts fora da allowlist', async () => {
    const result = await nfceHttpImportService.tryImport('https://evil.example.com/nfce?p=' + '1'.repeat(44));
    expect(result.ok).toBe(false);
  });
});

