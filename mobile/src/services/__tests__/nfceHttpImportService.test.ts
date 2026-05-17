import { parseRjHtml } from '../nfceHttpImportService';

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
  });
});

