import { Item } from '../types';

type ComparableUnit = 'kg' | 'l' | 'un';
type UnitCategory = 'weight' | 'volume' | 'count';

export interface PriceComparisonResult {
  isComparable: boolean;
  standardUnit: ComparableUnit | null;
  item1UnitPrice: number | null;
  item2UnitPrice: number | null;
  cheaperItem: Item | null;
  savingsPercentage: number | null;
  message: string;
}

const getUnitCategory = (unit: string): UnitCategory | null => {
  const normalizedUnit = unit.trim().toLowerCase();

  if (normalizedUnit === 'kg' || normalizedUnit === 'g') {
    return 'weight';
  }

  if (normalizedUnit === 'l') {
    return 'volume';
  }

  if (normalizedUnit === 'un') {
    return 'count';
  }

  return null;
};

const normalizeQuantity = (item: Item): { quantity: number; standardUnit: ComparableUnit } => {
  const unit = item.unit.trim().toLowerCase();

  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error('Quantidade inválida para comparação');
  }

  if (!Number.isFinite(item.price) || item.price < 0) {
    throw new Error('Preço inválido para comparação');
  }

  if (unit === 'kg') {
    return { quantity: item.quantity, standardUnit: 'kg' };
  }

  if (unit === 'g') {
    return { quantity: item.quantity / 1000, standardUnit: 'kg' };
  }

  if (unit === 'l') {
    return { quantity: item.quantity, standardUnit: 'l' };
  }

  if (unit === 'un') {
    return { quantity: item.quantity, standardUnit: 'un' };
  }

  throw new Error(`Unidade não suportada para comparação: ${item.unit}`);
};

export const calculateUnitPrice = (item: Item): number => {
  const { quantity } = normalizeQuantity(item);
  return item.price / quantity;
};

export const compareItems = (item1: Item, item2: Item): PriceComparisonResult => {
  const item1Category = getUnitCategory(item1.unit);
  const item2Category = getUnitCategory(item2.unit);

  if (!item1Category || !item2Category || item1Category !== item2Category) {
    return {
      isComparable: false,
      standardUnit: null,
      item1UnitPrice: null,
      item2UnitPrice: null,
      cheaperItem: null,
      savingsPercentage: null,
      message: 'Itens com unidades diferentes não podem ser comparados.',
    };
  }

  const item1Normalized = normalizeQuantity(item1);
  const item1UnitPrice = calculateUnitPrice(item1);
  const item2UnitPrice = calculateUnitPrice(item2);

  if (Math.abs(item1UnitPrice - item2UnitPrice) < 0.0001) {
    return {
      isComparable: true,
      standardUnit: item1Normalized.standardUnit,
      item1UnitPrice,
      item2UnitPrice,
      cheaperItem: null,
      savingsPercentage: 0,
      message: 'Os dois itens possuem o mesmo preço por unidade.',
    };
  }

  const cheaperItem = item1UnitPrice < item2UnitPrice ? item1 : item2;
  const moreExpensivePrice = Math.max(item1UnitPrice, item2UnitPrice);
  const cheaperPrice = Math.min(item1UnitPrice, item2UnitPrice);
  const savingsPercentage = ((moreExpensivePrice - cheaperPrice) / moreExpensivePrice) * 100;

  return {
    isComparable: true,
    standardUnit: item1Normalized.standardUnit,
    item1UnitPrice,
    item2UnitPrice,
    cheaperItem,
    savingsPercentage,
    message: `${cheaperItem.name} está mais barato por ${item1Normalized.standardUnit}.`,
  };
};
