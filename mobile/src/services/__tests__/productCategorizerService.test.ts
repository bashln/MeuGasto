import { CATEGORY_IDS, DEFAULT_PRODUCT_CATEGORY_RULES } from '../productCategoryRules';
import { ProductCategorizerService } from '../productCategorizerService';

describe('ProductCategorizerService', () => {
  let service: ProductCategorizerService;

  beforeEach(() => {
    service = new ProductCategorizerService({
      rules: DEFAULT_PRODUCT_CATEGORY_RULES,
      fallbackCategoryId: CATEGORY_IDS.OUTROS,
    });
  });

  it('possui dataset inicial com 50+ regras configuraveis', () => {
    expect(DEFAULT_PRODUCT_CATEGORY_RULES.length).toBeGreaterThanOrEqual(50);
  });

  it('retorna fallback Outros para item nao categorizado', () => {
    expect(service.categorizeProduct('Cabo USB-C 2m')).toBe(CATEGORY_IDS.OUTROS);
  });

  it('atinge cobertura de categorizacao >= 80% em dataset de validacao', () => {
    const dataset = [
      { name: 'Arroz Tipo 1', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Feijao Preto', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Macarrao Espaguete', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Azeite Extra Virgem', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Biscoito Recheado', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Pipoca Microondas', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Cuscuz Flocao', expected: CATEGORY_IDS.ALIMENTACAO },
      { name: 'Refrigerante Cola 2L', expected: CATEGORY_IDS.BEBIDAS },
      { name: 'Agua Mineral sem gas', expected: CATEGORY_IDS.BEBIDAS },
      { name: 'Suco de Uva Integral', expected: CATEGORY_IDS.BEBIDAS },
      { name: 'Cerveja Pilsen', expected: CATEGORY_IDS.BEBIDAS },
      { name: 'Cafe Torrado e Moido', expected: CATEGORY_IDS.BEBIDAS },
      { name: 'Detergente Neutro', expected: CATEGORY_IDS.LIMPEZA },
      { name: 'Sabao em po 1kg', expected: CATEGORY_IDS.LIMPEZA },
      { name: 'Agua sanitaria', expected: CATEGORY_IDS.LIMPEZA },
      { name: 'Limpador multiuso', expected: CATEGORY_IDS.LIMPEZA },
      { name: 'Papel higienico folha dupla', expected: CATEGORY_IDS.HIGIENE },
      { name: 'Shampoo Anticaspa', expected: CATEGORY_IDS.HIGIENE },
      { name: 'Creme dental menta', expected: CATEGORY_IDS.HIGIENE },
      { name: 'Desodorante aerosol', expected: CATEGORY_IDS.HIGIENE },
      { name: 'Pao frances', expected: CATEGORY_IDS.PADARIA },
      { name: 'Pao de queijo', expected: CATEGORY_IDS.PADARIA },
      { name: 'Bolo de cenoura', expected: CATEGORY_IDS.PADARIA },
      { name: 'Banana prata', expected: CATEGORY_IDS.HORTIFRUTI },
      { name: 'Tomate italiano', expected: CATEGORY_IDS.HORTIFRUTI },
      { name: 'Alface crespa', expected: CATEGORY_IDS.HORTIFRUTI },
      { name: 'Peito de frango congelado', expected: CATEGORY_IDS.CARNES_E_FRIOS },
      { name: 'Carne bovina acem', expected: CATEGORY_IDS.CARNES_E_FRIOS },
      { name: 'Presunto fatiado', expected: CATEGORY_IDS.CARNES_E_FRIOS },
      { name: 'Iogurte natural', expected: CATEGORY_IDS.LATICINIOS },
      { name: 'Leite integral 1L', expected: CATEGORY_IDS.LATICINIOS },
      { name: 'Requeijao cremoso', expected: CATEGORY_IDS.LATICINIOS },
      { name: 'Pilha alcalina AA', expected: CATEGORY_IDS.OUTROS },
      { name: 'Cabo HDMI 2m', expected: CATEGORY_IDS.OUTROS },
      { name: 'Lapis HB', expected: CATEGORY_IDS.OUTROS },
    ];

    const hits = dataset.filter((item) => service.categorizeProduct(item.name) === item.expected).length;
    const coverage = hits / dataset.length;

    expect(coverage).toBeGreaterThanOrEqual(0.8);
  });

  it('prioriza categoria aprendida apos reclassificacao manual', async () => {
    await service.learnReclassification('Cafe Torrado e Moido', CATEGORY_IDS.ALIMENTACAO);

    expect(service.categorizeProduct('café torrado e moído')).toBe(CATEGORY_IDS.ALIMENTACAO);
  });

  it('carrega reclassificacoes persistidas ao inicializar', async () => {
    const load = jest.fn().mockResolvedValue([
      { productName: 'cafe torrado e moido', categoryId: CATEGORY_IDS.ALIMENTACAO },
    ]);
    const persistedService = new ProductCategorizerService({
      rules: DEFAULT_PRODUCT_CATEGORY_RULES,
      fallbackCategoryId: CATEGORY_IDS.OUTROS,
      persistence: {
        load,
        save: jest.fn().mockResolvedValue(undefined),
      },
    });

    await persistedService.ready();

    expect(load).toHaveBeenCalledTimes(1);
    expect(persistedService.categorizeProduct('Café torrado e moído')).toBe(CATEGORY_IDS.ALIMENTACAO);
  });

  it('persiste reclassificacao ao aprender categoria manual', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const persistedService = new ProductCategorizerService({
      rules: DEFAULT_PRODUCT_CATEGORY_RULES,
      fallbackCategoryId: CATEGORY_IDS.OUTROS,
      persistence: {
        load: jest.fn().mockResolvedValue([]),
        save,
      },
    });

    await persistedService.ready();
    await persistedService.learnReclassification('Detergente Neutro', CATEGORY_IDS.ALIMENTACAO);

    expect(save).toHaveBeenCalledWith({
      productName: 'detergente neutro',
      categoryId: CATEGORY_IDS.ALIMENTACAO,
    });
  });

  it('ready() apos reload aguarda novo load completar', async () => {
    let resolveSecondLoad: (entries: { productName: string; categoryId: number }[]) => void = () => {};
    const load = jest.fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondLoad = resolve; }));

    const svc = new ProductCategorizerService({
      rules: DEFAULT_PRODUCT_CATEGORY_RULES,
      fallbackCategoryId: CATEGORY_IDS.OUTROS,
      persistence: { load, save: jest.fn().mockResolvedValue(undefined) },
    });

    await svc.ready();
    void svc.reload();

    let readyResolved = false;
    const readyPromise = svc.ready().then(() => { readyResolved = true; });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(readyResolved).toBe(false);

    resolveSecondLoad([{ productName: 'cabo usb-c 2m', categoryId: CATEGORY_IDS.HIGIENE }]);
    await readyPromise;
    expect(readyResolved).toBe(true);
    expect(svc.categorizeProduct('Cabo USB-C 2m')).toBe(CATEGORY_IDS.HIGIENE);
  });

  it('reloads concorrentes nao poluem o mapa com dados antigos', async () => {
    let resolveFirstReload: (entries: { productName: string; categoryId: number }[]) => void = () => {};
    let resolveSecondReload: (entries: { productName: string; categoryId: number }[]) => void = () => {};
    const load = jest.fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirstReload = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecondReload = resolve; }));

    const svc = new ProductCategorizerService({
      rules: DEFAULT_PRODUCT_CATEGORY_RULES,
      fallbackCategoryId: CATEGORY_IDS.OUTROS,
      persistence: { load, save: jest.fn().mockResolvedValue(undefined) },
    });

    await svc.ready();

    const reload1 = svc.reload();
    const reload2 = svc.reload();

    resolveSecondReload([{ productName: 'item novo', categoryId: CATEGORY_IDS.LATICINIOS }]);
    await reload2;

    expect(svc.categorizeProduct('item novo')).toBe(CATEGORY_IDS.LATICINIOS);

    resolveFirstReload([{ productName: 'item antigo do user anterior', categoryId: CATEGORY_IDS.LIMPEZA }]);
    await reload1;

    expect(svc.categorizeProduct('item antigo do user anterior')).toBe(CATEGORY_IDS.OUTROS);
    expect(svc.categorizeProduct('item novo')).toBe(CATEGORY_IDS.LATICINIOS);
  });

  it('reload limpa reclassificacoes aprendidas e recarrega da persistencia', async () => {
    // "Cabo USB-C 2m" nao esta nas regras estaticas → retorna OUTROS por padrao
    const load = jest.fn()
      .mockResolvedValueOnce([{ productName: 'cabo usb-c 2m', categoryId: CATEGORY_IDS.HIGIENE }])
      .mockResolvedValueOnce([]);

    const svc = new ProductCategorizerService({
      rules: DEFAULT_PRODUCT_CATEGORY_RULES,
      fallbackCategoryId: CATEGORY_IDS.OUTROS,
      persistence: { load, save: jest.fn().mockResolvedValue(undefined) },
    });

    await svc.ready();
    expect(svc.categorizeProduct('Cabo USB-C 2m')).toBe(CATEGORY_IDS.HIGIENE);

    await svc.reload();
    expect(svc.categorizeProduct('Cabo USB-C 2m')).toBe(CATEGORY_IDS.OUTROS);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
