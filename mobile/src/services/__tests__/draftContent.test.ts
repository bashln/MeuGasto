import { parseContent, serializeContent, DraftItem } from '../draftContent';

const ITEMS: DraftItem[] = [
  { name: 'Leite', quantity: 2, unit: 'l', price: 3.5 },
  { name: 'Pão', quantity: 1, unit: 'un', price: 5.0 },
];

describe('parseContent', () => {
  it('retorna notes e items de um JSON válido', () => {
    const content = JSON.stringify({ notes: 'Compra semanal', items: ITEMS });
    const result = parseContent(content);
    expect(result.notes).toBe('Compra semanal');
    expect(result.items).toEqual(ITEMS);
  });

  it('retorna notas vazias e items vazios para null', () => {
    const result = parseContent(null);
    expect(result.notes).toBe('');
    expect(result.items).toEqual([]);
  });

  it('retorna notas vazias e items vazios para string vazia', () => {
    const result = parseContent('');
    expect(result.notes).toBe('');
    expect(result.items).toEqual([]);
  });

  it('faz fallback para texto puro (compatibilidade retroativa)', () => {
    const result = parseContent('Nota de texto livre');
    expect(result.notes).toBe('Nota de texto livre');
    expect(result.items).toEqual([]);
  });

  it('faz fallback para JSON sem campo notes', () => {
    const result = parseContent('{"outro": "campo"}');
    expect(result.notes).toBe('{"outro": "campo"}');
    expect(result.items).toEqual([]);
  });

  it('faz fallback para JSON malformado', () => {
    const result = parseContent('{"malformado');
    expect(result.notes).toBe('{"malformado');
    expect(result.items).toEqual([]);
  });

  it('retorna items vazio quando JSON não tem items', () => {
    const content = JSON.stringify({ notes: 'só descrição' });
    const result = parseContent(content);
    expect(result.notes).toBe('só descrição');
    expect(result.items).toEqual([]);
  });

  it('preserva todos os campos dos items', () => {
    const content = JSON.stringify({ notes: '', items: ITEMS });
    const { items } = parseContent(content);
    expect(items[0]).toEqual({ name: 'Leite', quantity: 2, unit: 'l', price: 3.5 });
    expect(items[1]).toEqual({ name: 'Pão', quantity: 1, unit: 'un', price: 5.0 });
  });
});

describe('serializeContent', () => {
  it('serializa notas e items em JSON', () => {
    const result = serializeContent('Compra semanal', ITEMS);
    const parsed = JSON.parse(result);
    expect(parsed.notes).toBe('Compra semanal');
    expect(parsed.items).toEqual(ITEMS);
  });

  it('serializa com items vazio', () => {
    const result = serializeContent('só notas', []);
    const parsed = JSON.parse(result);
    expect(parsed.notes).toBe('só notas');
    expect(parsed.items).toEqual([]);
  });

  it('serializa com notas vazias', () => {
    const result = serializeContent('', ITEMS);
    const parsed = JSON.parse(result);
    expect(parsed.notes).toBe('');
    expect(parsed.items).toEqual(ITEMS);
  });
});

describe('round-trip parseContent ↔ serializeContent', () => {
  it('parsear após serializar retorna os dados originais', () => {
    const notes = 'Compra de quinta';
    const items: DraftItem[] = [{ name: 'Arroz', quantity: 5, unit: 'kg', price: 4.99 }];

    const serialized = serializeContent(notes, items);
    const parsed = parseContent(serialized);

    expect(parsed.notes).toBe(notes);
    expect(parsed.items).toEqual(items);
  });

  it('round-trip com múltiplos items e notas com acentos', () => {
    const notes = 'Compra de sábado — mercado perto';
    const items: DraftItem[] = [
      { name: 'Açúcar', quantity: 1, unit: 'kg', price: 3.2 },
      { name: 'Maçã', quantity: 6, unit: 'un', price: 0.9 },
    ];

    const result = parseContent(serializeContent(notes, items));
    expect(result.notes).toBe(notes);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('Açúcar');
    expect(result.items[1].price).toBe(0.9);
  });
});
