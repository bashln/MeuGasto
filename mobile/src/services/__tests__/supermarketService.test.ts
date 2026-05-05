jest.mock('../../lib/supabaseClient', () => {
  const mockClient = { from: jest.fn() };
  return {
    supabase: mockClient,
    getSupabaseClient: jest.fn().mockReturnValue(mockClient),
    isSupabaseConfigured: jest.fn().mockReturnValue(true),
  };
});

jest.mock('../authService', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('11111111-1111-4111-8111-111111111111'),
}));

import { supermarketService } from '../supermarketService';
import { supabase } from '../../lib/supabaseClient';

const mockFrom = supabase!.from as jest.Mock;

const makeChain = (singleResult: unknown, listResult?: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue(singleResult),
  or: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(listResult),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockResolvedValue(listResult),
  update: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
});

describe('supermarketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista supermercados com paginacao e mapeamento', async () => {
    const listResult = {
      data: [{
        id: 3,
        name: 'Mercado Bairro',
        cnpj: '123',
        city: 'POA',
        state: 'RS',
        manual: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }],
      error: null,
      count: 1,
    };
    const chain = makeChain({ data: null, error: null }, listResult);
    mockFrom.mockReturnValue(chain);

    const result = await supermarketService.getSupermarkets(1, 10);

    expect(chain.range).toHaveBeenCalledWith(10, 19);
    expect(result).toEqual({
      data: [{
        id: 3,
        name: 'Mercado Bairro',
        cnpj: '123',
        city: 'POA',
        state: 'RS',
        isManual: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      }],
      page: {
        pageNumber: 1,
        pageSize: 10,
        totalElements: 1,
        totalPages: 1,
      },
    });
  });

  it('retorna supermercado proprio por id', async () => {
    const chain = makeChain({
      data: {
        id: 10,
        name: 'Meu Mercado',
        cnpj: null,
        city: 'Curitiba',
        state: 'PR',
        manual: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const result = await supermarketService.getSupermarketById(10);

    expect(result).toMatchObject({ id: 10, name: 'Meu Mercado', isManual: true });
  });

  it('faz fallback para supermercado global quando nao encontra o proprio', async () => {
    const ownChain = makeChain({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });
    ownChain.is = jest.fn();

    const globalChain = makeChain({
      data: {
        id: 20,
        name: 'Mercado Global',
        cnpj: null,
        city: 'Florianopolis',
        state: 'SC',
        manual: false,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      error: null,
    });
    globalChain.is = jest.fn().mockReturnThis();

    mockFrom
      .mockReturnValueOnce(ownChain)
      .mockReturnValueOnce(globalChain);

    const result = await supermarketService.getSupermarketById(20);

    expect(result).toMatchObject({ id: 20, name: 'Mercado Global', isManual: false });
    expect(globalChain.is).toHaveBeenCalledWith('user_id', null);
  });

  it('cria supermercado manual com user_id atual', async () => {
    const chain = makeChain(
      {
        data: {
          id: 99,
          name: 'Novo Mercado',
          cnpj: '12345678000195',
          city: 'Sao Paulo',
          state: 'SP',
          manual: true,
          created_at: '2026-03-01T00:00:00.000Z',
          updated_at: '2026-03-01T00:00:00.000Z',
        },
        error: null,
      }
    );
    mockFrom.mockReturnValue(chain);

    const result = await supermarketService.createSupermarket({
      name: 'Novo Mercado',
      cnpj: '12345678000195',
      city: 'Sao Paulo',
      state: 'SP',
    });

    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Novo Mercado',
      manual: true,
      user_id: '11111111-1111-4111-8111-111111111111',
    }));
    expect(result).toMatchObject({ id: 99, name: 'Novo Mercado', isManual: true });
  });

  it('bloqueia update de supermercado nao manual', async () => {
    const chain = makeChain({ data: { manual: false, user_id: 'user-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    await expect(
      supermarketService.updateSupermarket(1, { name: 'Novo nome' })
    ).rejects.toThrow(/N[aã]o [ée] poss[ií]vel editar supermercados criados via QR Code/i);
  });

  it('mapeia supermercados na busca por nome', async () => {
    const chain = makeChain(
      { data: null, error: null },
      {
        data: [{
          id: 7,
          name: 'Mercado Centro',
          cnpj: null,
          city: 'POA',
          state: 'RS',
          manual: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        }],
        error: null,
      }
    );
    mockFrom.mockReturnValue(chain);

    const result = await supermarketService.searchSupermarkets('Centro');

    expect(result[0]).toMatchObject({ id: 7, name: 'Mercado Centro', isManual: true });
  });

  it('deleta supermercado manual sem compras associadas', async () => {
    const existingChain = makeChain({ data: { manual: true, user_id: '11111111-1111-4111-8111-111111111111' }, error: null });
    const purchasesChain = makeChain({ data: null, error: null });
    purchasesChain.select = jest.fn().mockReturnThis();
    purchasesChain.eq = jest.fn().mockResolvedValue({ count: 0, error: null });
    const deleteChain = makeChain({ data: null, error: null });
    deleteChain.eq = jest.fn().mockReturnThis();
    deleteChain.delete = jest.fn().mockReturnThis();

    mockFrom
      .mockReturnValueOnce(existingChain)
      .mockReturnValueOnce(purchasesChain)
      .mockReturnValueOnce(deleteChain);

    await expect(supermarketService.deleteSupermarket(7)).resolves.toBeUndefined();
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.eq).toHaveBeenCalledWith('user_id', '11111111-1111-4111-8111-111111111111');
  });
});
