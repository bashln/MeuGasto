import { formatMoney, formatMoneyInput, parseMoney } from '../formatMoney';

describe('formatMoney', () => {
  it('formata valor positivo com duas casas decimais', () => {
    expect(formatMoney(10.5)).toMatch(/10,50/);
  });

  it('formata zero', () => {
    expect(formatMoney(0)).toMatch(/0,00/);
  });

  it('formata valor negativo', () => {
    expect(formatMoney(-5.99)).toMatch(/5,99/);
  });

  it('inclui símbolo de moeda BRL', () => {
    const result = formatMoney(1);
    expect(result).toMatch(/R\$|BRL/);
  });

  it('formata valor grande com separador de milhar', () => {
    expect(formatMoney(1234.56)).toMatch(/1\.234,56|1,234\.56/);
  });
});

describe('formatMoneyInput', () => {
  it('converte string numérica em formato decimal', () => {
    expect(formatMoneyInput('1234')).toBe('12,34');
  });

  it('trata string vazia como zero', () => {
    expect(formatMoneyInput('')).toBe('0,00');
  });

  it('ignora caracteres não numéricos', () => {
    expect(formatMoneyInput('abc12')).toBe('0,12');
  });

  it('formata centavos corretamente', () => {
    expect(formatMoneyInput('100')).toBe('1,00');
  });
});

describe('parseMoney', () => {
  it('parseia string formatada em número', () => {
    expect(parseMoney('R$ 12,50')).toBeCloseTo(12.5);
  });

  it('parseia string simples com vírgula', () => {
    expect(parseMoney('0,00')).toBe(0);
  });

  it('retorna 0 para string vazia', () => {
    expect(parseMoney('')).toBe(0);
  });

  it('parseia valor sem símbolo', () => {
    expect(parseMoney('99,90')).toBeCloseTo(99.9);
  });

  it('retorna 0 para string não numérica', () => {
    expect(parseMoney('abc')).toBe(0);
  });
});
