export const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatMoneyInput = (value: string): string => {
  const numericValue = value.replace(/\D/g, '');
  const number = numericValue ? parseFloat(numericValue) : 0;
  const formatted = (number / 100).toFixed(2);
  return formatted.replace('.', ',');
};

export const parseMoney = (value: string): number => {
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
};
