jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../authService', () => ({
  getCurrentUserId: jest.fn().mockResolvedValue('user-1'),
}));

import { supermarketService } from '../supermarketService';
import { supabase } from '../../lib/supabaseClient';

const mockFrom = supabase.from as jest.Mock;

const makeChain = (singleResult: unknown, listResult?: unknown) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
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
});
