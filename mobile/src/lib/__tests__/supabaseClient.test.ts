describe('supabaseClient configuration', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const loadModule = () => {
    let mod: typeof import('../supabaseClient');

    jest.isolateModules(() => {
      mod = require('../supabaseClient') as typeof import('../supabaseClient');
    });

    return mod!;
  };

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    }

    jest.resetModules();
    jest.clearAllMocks();
  });

  it('resolve configuracao a partir de process.env', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://env.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'env-key';

    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            supabaseUrl: 'https://extra.supabase.co',
            supabaseAnonKey: 'extra-key',
          },
        },
      },
    }));

    const { getResolvedSupabaseConfig } = loadModule();

    expect(getResolvedSupabaseConfig()).toEqual({
      url: 'https://env.supabase.co',
      anonKey: 'env-key',
      source: 'process.env',
      error: null,
    });
  });

  it('usa fallback via expo.extra quando process.env nao estiver disponivel', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            supabaseUrl: 'https://extra.supabase.co',
            supabaseAnonKey: 'extra-key',
          },
        },
      },
    }));

    const { getResolvedSupabaseConfig, isSupabaseConfigured } = loadModule();

    expect(getResolvedSupabaseConfig()).toEqual({
      url: 'https://extra.supabase.co',
      anonKey: 'extra-key',
      source: 'expo.extra',
      error: null,
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('rejeita URL invalida', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://bad-host';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'env-key';

    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));

    const { getResolvedSupabaseConfig, isSupabaseConfigured } = loadModule();

    expect(getResolvedSupabaseConfig()).toEqual({
      url: 'http://bad-host',
      anonKey: 'env-key',
      source: 'process.env',
      error: 'invalid_url',
    });
    expect(isSupabaseConfigured()).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('detecta URL ausente', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'env-key';

    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));

    const { getResolvedSupabaseConfig } = loadModule();

    expect(getResolvedSupabaseConfig()).toEqual({
      url: null,
      anonKey: 'env-key',
      source: 'process.env',
      error: 'missing_url',
    });
  });
});
