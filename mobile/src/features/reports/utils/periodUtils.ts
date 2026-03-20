import { addDays, subMonths } from 'date-fns';

interface PeriodRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

const toDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


export const getPeriodRange = (
  period: '3months' | '6months' | '12months' | 'year',
  referenceDate: Date = new Date()
): PeriodRange => {
  if (!(referenceDate instanceof Date) || isNaN(referenceDate.getTime())) {
    throw new Error('getPeriodRange: referenceDate must be a valid Date');
  }

  let startDate = new Date(referenceDate);
  const endDate = new Date(referenceDate);

  switch (period) {
    case '3months':
      startDate = subMonths(referenceDate, 3);
      break;
    case '6months':
      startDate = subMonths(referenceDate, 6);
      break;
    case '12months':
      startDate = subMonths(referenceDate, 12);
      break;
    case 'year':
      startDate = new Date(referenceDate.getFullYear(), 0, 1); // Janeiro 1 do ano atual
      break;
  }

  return {
    startDate: toDateOnly(startDate),
    endDate: toDateOnly(endDate),
  };
};

export const getPreviousPeriodRange = (
  period: '3months' | '6months' | '12months' | 'year',
  referenceDate: Date = new Date()
): PeriodRange => {
  if (period === 'year') {
    const previousYear = referenceDate.getFullYear() - 1;
    return {
      startDate: `${previousYear}-01-01`,
      endDate: `${previousYear}-12-31`,
    };
  }

  const currentRange = getPeriodRange(period, referenceDate);
  const previousEndDate = addDays(new Date(currentRange.startDate), -1);
  const previousReferenceDate = new Date(previousEndDate);

  return getPeriodRange(period, previousReferenceDate);
};

// Função para manter compatibilidade com seleção de ano
export const getYearRange = (year: number): PeriodRange => {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
};
