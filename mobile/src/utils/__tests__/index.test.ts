import { formatDate, formatMoney } from '../index';

describe('utils/index exports', () => {
  it('reexporta funcoes utilitarias principais', () => {
    expect(typeof formatDate).toBe('function');
    expect(typeof formatMoney).toBe('function');
  });
});
