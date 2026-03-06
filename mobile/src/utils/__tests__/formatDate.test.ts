import { formatDate, formatDateInput, getMonthName, getCurrentMonth, getCurrentYear } from '../formatDate';

describe('formatDate', () => {
  it('formata data em dd/mm/aaaa', () => {
    expect(formatDate('2024-01-15')).toBe('15/01/2024');
  });

  it('formata mês e dia com zero à esquerda', () => {
    expect(formatDate('2024-03-05')).toBe('05/03/2024');
  });

  it('formata dezembro corretamente', () => {
    expect(formatDate('2023-12-31')).toBe('31/12/2023');
  });
});

describe('formatDateInput', () => {
  it('converte Date em string ISO yyyy-mm-dd', () => {
    const date = new Date('2024-06-20T12:00:00Z');
    expect(formatDateInput(date)).toBe('2024-06-20');
  });
});

describe('getMonthName', () => {
  it('retorna nome do mês 1 (Janeiro)', () => {
    expect(getMonthName(1)).toBe('Janeiro');
  });

  it('retorna nome do mês 12 (Dezembro)', () => {
    expect(getMonthName(12)).toBe('Dezembro');
  });

  it('retorna todos os 12 meses corretamente', () => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    meses.forEach((nome, index) => {
      expect(getMonthName(index + 1)).toBe(nome);
    });
  });

  it('retorna string vazia para mês inválido (0)', () => {
    expect(getMonthName(0)).toBe('');
  });

  it('retorna string vazia para mês inválido (13)', () => {
    expect(getMonthName(13)).toBe('');
  });
});

describe('getCurrentMonth', () => {
  it('retorna número entre 1 e 12', () => {
    const month = getCurrentMonth();
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});

describe('getCurrentYear', () => {
  it('retorna o ano atual', () => {
    expect(getCurrentYear()).toBe(new Date().getFullYear());
  });
});
