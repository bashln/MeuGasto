import { formatDate, formatMoney, calculateUnitPrice, compareItems } from '../index';

describe('utils/index exports', () => {
  it('reexporta funcoes utilitarias principais', () => {
    expect(typeof formatDate).toBe('function');
    expect(typeof formatMoney).toBe('function');
    expect(typeof calculateUnitPrice).toBe('function');
    expect(typeof compareItems).toBe('function');
  });
});
