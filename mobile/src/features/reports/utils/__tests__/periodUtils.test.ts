import { getPeriodRange, getPreviousPeriodRange, getYearRange } from '../periodUtils';

// Use local-time constructor to avoid UTC/timezone shifts in YYYY-MM-DD string parsing
const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe('getPeriodRange', () => {
  describe('3months', () => {
    it('retorna os 3 meses anteriores a partir de uma data normal', () => {
      const { startDate, endDate } = getPeriodRange('3months', d(2025, 3, 15));
      expect(startDate).toBe('2024-12-15');
      expect(endDate).toBe('2025-03-15');
    });

    it('clip de fim-de-mes: Jan 31 - 3 meses = Out 31 (outubro tem 31 dias, sem overflow)', () => {
      const { startDate, endDate } = getPeriodRange('3months', d(2025, 1, 31));
      expect(startDate).toBe('2024-10-31');
      expect(endDate).toBe('2025-01-31');
    });
  });

  describe('6months', () => {
    it('retorna os 6 meses anteriores a partir de uma data normal', () => {
      const { startDate, endDate } = getPeriodRange('6months', d(2025, 6, 15));
      expect(startDate).toBe('2024-12-15');
      expect(endDate).toBe('2025-06-15');
    });

    it('clip de fim-de-mes: Mai 31 - 6 meses = Nov 30 (novembro tem 30 dias)', () => {
      const { startDate, endDate } = getPeriodRange('6months', d(2025, 5, 31));
      expect(startDate).toBe('2024-11-30');
      expect(endDate).toBe('2025-05-31');
    });

    it('clip de fim-de-mes: Mar 31 - 6 meses = Set 30 (setembro tem 30 dias)', () => {
      const { startDate, endDate } = getPeriodRange('6months', d(2025, 3, 31));
      expect(startDate).toBe('2024-09-30');
      expect(endDate).toBe('2025-03-31');
    });
  });

  describe('12months', () => {
    it('retorna os 12 meses anteriores a partir de uma data normal', () => {
      const { startDate, endDate } = getPeriodRange('12months', d(2025, 3, 15));
      expect(startDate).toBe('2024-03-15');
      expect(endDate).toBe('2025-03-15');
    });

    it('clip de fim-de-mes: Mar 31 - 12 meses = Mar 31 (marco tem 31 dias)', () => {
      const { startDate, endDate } = getPeriodRange('12months', d(2025, 3, 31));
      expect(startDate).toBe('2024-03-31');
      expect(endDate).toBe('2025-03-31');
    });
  });

  describe('year', () => {
    it('retorna desde 1 de janeiro do ano da referencia ate a data de referencia', () => {
      const { startDate, endDate } = getPeriodRange('year', d(2025, 7, 20));
      expect(startDate).toBe('2025-01-01');
      expect(endDate).toBe('2025-07-20');
    });

    it('no primeiro dia do ano, startDate e endDate sao o mesmo dia', () => {
      const { startDate, endDate } = getPeriodRange('year', d(2025, 1, 1));
      expect(startDate).toBe('2025-01-01');
      expect(endDate).toBe('2025-01-01');
    });

    it('em ano bissexto, startDate e 1 de janeiro do mesmo ano', () => {
      const { startDate } = getPeriodRange('year', d(2024, 8, 15));
      expect(startDate).toBe('2024-01-01');
    });
  });

  describe('validacao de referenceDate', () => {
    it('lanca erro quando referenceDate e null', () => {
      expect(() => getPeriodRange('3months', null as unknown as Date)).toThrow(
        'getPeriodRange: referenceDate must be a valid Date'
      );
    });

    it('lanca erro quando referenceDate e uma string', () => {
      expect(() => getPeriodRange('3months', '2025-01-01' as unknown as Date)).toThrow(
        'getPeriodRange: referenceDate must be a valid Date'
      );
    });

    it('lanca erro quando referenceDate e Invalid Date', () => {
      expect(() => getPeriodRange('3months', new Date('invalid'))).toThrow(
        'getPeriodRange: referenceDate must be a valid Date'
      );
    });

    it('nao lanca erro com uma data valida', () => {
      expect(() => getPeriodRange('3months', d(2025, 1, 1))).not.toThrow();
    });
  });
});

describe('getPreviousPeriodRange', () => {
  it('year: retorna o ano completo anterior sem depender de timezone', () => {
    const { startDate, endDate } = getPreviousPeriodRange('year', d(2025, 7, 20));
    expect(startDate).toBe('2024-01-01');
    expect(endDate).toBe('2024-12-31');
  });

  it('year: ano anterior de referencia em ano bissexto', () => {
    const { startDate, endDate } = getPreviousPeriodRange('year', d(2024, 4, 10));
    expect(startDate).toBe('2023-01-01');
    expect(endDate).toBe('2023-12-31');
  });

  it('3months: periodo anterior termina antes do periodo atual comecar', () => {
    const ref = d(2025, 1, 31);
    const current = getPeriodRange('3months', ref);
    const previous = getPreviousPeriodRange('3months', ref);

    // Verificacao por comparacao de strings YYYY-MM-DD (funciona como ordenacao lexicografica)
    expect(previous.endDate < current.startDate).toBe(true);
  });

  it('6months: periodo anterior termina antes do periodo atual comecar', () => {
    const ref = d(2025, 6, 15);
    const current = getPeriodRange('6months', ref);
    const previous = getPreviousPeriodRange('6months', ref);

    expect(previous.endDate < current.startDate).toBe(true);
    expect(previous.startDate < previous.endDate).toBe(true);
  });
});

describe('getYearRange', () => {
  it('retorna o range completo do ano nao-bissexto', () => {
    const { startDate, endDate } = getYearRange(2025);
    expect(startDate).toBe('2025-01-01');
    expect(endDate).toBe('2025-12-31');
  });

  it('retorna o range completo do ano bissexto', () => {
    const { startDate, endDate } = getYearRange(2024);
    expect(startDate).toBe('2024-01-01');
    expect(endDate).toBe('2024-12-31');
  });

  it('ano qualquer sempre termina em 12-31', () => {
    expect(getYearRange(2000).endDate).toBe('2000-12-31');
    expect(getYearRange(2099).endDate).toBe('2099-12-31');
  });
});
