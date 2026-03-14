import { Item } from '../../types';
import { calculateUnitPrice, compareItems } from '../priceComparison';

const createItem = (overrides: Partial<Item>): Item => ({
  id: 1,
  name: 'Item',
  quantity: 1,
  unit: 'kg',
  price: 10,
  ...overrides,
});

describe('calculateUnitPrice', () => {
  it('converte gramas para kg ao calcular preço por unidade', () => {
    const item = createItem({ quantity: 500, unit: 'g', price: 10 });

    expect(calculateUnitPrice(item)).toBeCloseTo(20);
  });

  it('calcula corretamente com unidade em kg', () => {
    const item = createItem({ quantity: 1, unit: 'kg', price: 16.9 });

    expect(calculateUnitPrice(item)).toBeCloseTo(16.9);
  });

  it('lança erro para quantidade inválida', () => {
    const item = createItem({ quantity: 0, unit: 'kg', price: 10 });

    expect(() => calculateUnitPrice(item)).toThrow('Quantidade inválida para comparação');
  });
});

describe('compareItems', () => {
  it('identifica o item mais barato por kg entre g e kg', () => {
    const item500g = createItem({ id: 1, name: 'Arroz 500g', quantity: 500, unit: 'g', price: 10 });
    const item1kg = createItem({ id: 2, name: 'Arroz 1kg', quantity: 1, unit: 'kg', price: 16.9 });

    const result = compareItems(item500g, item1kg);

    expect(result.isComparable).toBe(true);
    expect(result.standardUnit).toBe('kg');
    expect(result.cheaperItem?.id).toBe(2);
    expect(result.item1UnitPrice).toBeCloseTo(20);
    expect(result.item2UnitPrice).toBeCloseTo(16.9);
  });

  it('retorna não comparável para categorias de unidade diferentes', () => {
    const arroz = createItem({ id: 1, name: 'Arroz', quantity: 1, unit: 'kg', price: 10 });
    const refrigerante = createItem({ id: 2, name: 'Refrigerante', quantity: 2, unit: 'l', price: 12 });

    const result = compareItems(arroz, refrigerante);

    expect(result.isComparable).toBe(false);
    expect(result.cheaperItem).toBeNull();
    expect(result.standardUnit).toBeNull();
  });

  it('retorna empate quando preço por unidade é igual', () => {
    const item1 = createItem({ id: 1, name: 'Feijão A', quantity: 500, unit: 'g', price: 5 });
    const item2 = createItem({ id: 2, name: 'Feijão B', quantity: 1, unit: 'kg', price: 10 });

    const result = compareItems(item1, item2);

    expect(result.isComparable).toBe(true);
    expect(result.cheaperItem).toBeNull();
    expect(result.savingsPercentage).toBe(0);
  });
});
