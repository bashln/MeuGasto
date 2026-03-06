import { escapeCsvCell, toCsvRow } from '../csvSecurity';

describe('csvSecurity', () => {
  it('escapa aspas e encapsula celula', () => {
    expect(escapeCsvCell('Mercado "Bom"')).toBe('"Mercado ""Bom"""');
  });

  it('previne formula injection com prefixo perigoso', () => {
    expect(escapeCsvCell('=2+2')).toBe('"\'=2+2"');
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
  });

  it('gera linha csv com quebra de linha preservada e escapada', () => {
    expect(toCsvRow(['Nome', 'valor,1', 'linha\n2'])).toBe('"Nome","valor,1","linha\n2"');
  });
});
