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

const addDays = (date: Date, days: number): Date => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export const getPeriodRange = (
  period: '3months' | '6months' | '12months' | 'year',
  referenceDate: Date = new Date()
): PeriodRange => {
  let startDate = new Date(referenceDate);
  const endDate = new Date(referenceDate);

  switch (period) {
    case '3months':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6months':
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case '12months':
      startDate.setMonth(startDate.getMonth() - 12);
      break;
    case 'year':
      startDate = new Date(referenceDate.getFullYear(), 0, 1); // Janeiro 1 do ano atual
      break;
  }
  
  // Normalizar para início do dia
  startDate.setHours(0, 0, 0, 0);

  // End date é a data de referência (fim do dia)
  endDate.setHours(23, 59, 59, 999);

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
