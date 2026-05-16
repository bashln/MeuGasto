import { Item } from '../../types';
import { calculateUnitPrice, compareItems, findCheapestItem, getStandardUnit } from '../priceComparison';

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

describe('getStandardUnit', () => {
  it('normaliza kg e g para kg', () => {
    expect(getStandardUnit('kg')).toBe('kg');
    expect(getStandardUnit('g')).toBe('kg');
    expect(getStandardUnit('KG')).toBe('kg');
  });

  it('normaliza l e ml para l', () => {
    expect(getStandardUnit('l')).toBe('l');
    expect(getStandardUnit('ml')).toBe('l');
  });

  it('retorna un para count', () => {
    expect(getStandardUnit('un')).toBe('un');
    expect(getStandardUnit('UN')).toBe('un');
  });

  it('retorna null para unidades não suportadas', () => {
    expect(getStandardUnit('pc')).toBeNull();
    expect(getStandardUnit('cx')).toBeNull();
    expect(getStandardUnit('')).toBeNull();
  });
});

describe('calculateUnitPrice — cobertura ml', () => {
  it('500ml a R$5 retorna R$10 por litro', () => {
    const item = createItem({ quantity: 500, unit: 'ml', price: 5 });
    expect(calculateUnitPrice(item)).toBeCloseTo(10);
  });
});

describe('findCheapestItem', () => {
  it('retorna null para lista vazia', () => {
    expect(findCheapestItem([])).toBeNull();
  });

  it('escolhe o mais barato quando categoria é homogênea (kg + g)', () => {
    const cheap = createItem({ id: 1, unit: 'kg', quantity: 1, price: 10 });
    const expensive = createItem({ id: 2, unit: 'g', quantity: 500, price: 8 });
    expect(findCheapestItem([cheap, expensive])?.id).toBe(1);
  });

  it('retorna null quando categorias divergem (fail-safe)', () => {
    const weight = createItem({ id: 1, unit: 'kg', quantity: 1, price: 10 });
    const volume = createItem({ id: 2, unit: 'l', quantity: 1, price: 8 });
    expect(findCheapestItem([weight, volume])).toBeNull();
  });

  it('filtra itens com unidades não suportadas antes de comparar', () => {
    const valid = createItem({ id: 1, unit: 'un', quantity: 1, price: 5 });
    const invalid = createItem({ id: 2, unit: 'pc', quantity: 1, price: 3 });
    expect(findCheapestItem([valid, invalid])?.id).toBe(1);
  });

  it('retorna null se todos têm unidades não suportadas', () => {
    const a = createItem({ id: 1, unit: 'pc', quantity: 1, price: 5 });
    const b = createItem({ id: 2, unit: 'cx', quantity: 1, price: 3 });
    expect(findCheapestItem([a, b])).toBeNull();
  });
});
