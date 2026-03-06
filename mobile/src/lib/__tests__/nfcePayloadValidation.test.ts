import { validateAndSanitizeNFCePayload } from '../nfcePayloadValidation';

describe('validateAndSanitizeNFCePayload', () => {
  it('sanitiza texto e mantem payload valido', () => {
    const data = validateAndSanitizeNFCePayload({
      storeName: '  Mercado\nCentral\t ',
      cnpj: '12.345.678/0001-90',
      city: ' Porto Alegre ',
      state: 'rs',
      emittedAt: '01/02/2026 10:20:30',
      total: 123.45,
      items: [
        {
          name: '  Arroz Tipo 1  ',
          quantity: 2,
          unit: 'kg',
          unityPrice: 10,
          totalPrice: 20,
        },
      ],
    });

    expect(data.storeName).toBe('Mercado Central');
    expect(data.cnpj).toBe('12345678000190');
    expect(data.state).toBe('RS');
    expect(data.items[0].unit).toBe('KG');
  });

  it('rejeita payload sem items', () => {
    expect(() =>
      validateAndSanitizeNFCePayload({
        total: 10,
        items: [],
      })
    ).toThrow('Nenhum item encontrado na NFC-e.');
  });

  it('rejeita quantidade fora do range', () => {
    expect(() =>
      validateAndSanitizeNFCePayload({
        total: 10,
        items: [
          {
            name: 'Produto',
            quantity: 0,
            unit: 'UN',
          },
        ],
      })
    ).toThrow(/Quantidade do item 1/);
  });
});
