const mockCreateClient = jest.fn();
const mockExpoConfig = {
  extra: {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseAnonKey: 'mock-key',
  },
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig;
    },
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

jest.mock('../secureSessionStorage', () => ({
  secureSessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  SUPABASE_SESSION_STORAGE_KEY: 'supabase.auth.token',
}));

describe('supabaseClient', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockReset();
    mockExpoConfig.extra.supabaseUrl = 'https://mock.supabase.co';
    mockExpoConfig.extra.supabaseAnonKey = 'mock-key';
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it('reutiliza o mesmo client quando a configuracao nao muda', () => {
    const client = { auth: {}, from: jest.fn() };
    mockCreateClient.mockReturnValue(client);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../supabaseClient');

    expect(getSupabaseClient()).toBe(client);
    expect(getSupabaseClient()).toBe(client);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('recria o client quando a configuracao muda', () => {
    const firstClient = { id: 'first' };
    const secondClient = { id: 'second' };
    mockCreateClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let supabaseClient = require('../supabaseClient');
    expect(supabaseClient.getSupabaseClient()).toBe(firstClient);

    mockExpoConfig.extra.supabaseAnonKey = 'another-key';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    supabaseClient = require('../supabaseClient');

    expect(supabaseClient.getSupabaseClient()).toBe(secondClient);
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});
