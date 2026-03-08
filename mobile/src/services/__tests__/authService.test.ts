jest.mock('../../lib/supabaseClient', () => {
  const mockClient = {
    auth: {
      getSession: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };
  return {
    supabase: mockClient,
    getSupabaseClient: jest.fn().mockReturnValue(mockClient),
    getResolvedSupabaseConfig: jest.fn().mockReturnValue({
      url: 'https://mock.supabase.co',
      anonKey: 'mock-key',
      source: 'process.env',
      error: null,
    }),
    isSupabaseConfigured: jest.fn().mockReturnValue(true),
    supabaseUrl: 'https://mock.supabase.co',
  };
});

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { authService, getCurrentUserId } from '../authService';
import { supabase } from '../../lib/supabaseClient';
import * as supabaseClient from '../../lib/supabaseClient';
import * as SecureStore from 'expo-secure-store';

const mockGetSession = supabase!.auth.getSession as jest.Mock;
const mockSignOut = supabase!.auth.signOut as jest.Mock;
const mockSignInWithPassword = supabase!.auth.signInWithPassword as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;
const mockIsSupabaseConfigured = supabaseClient.isSupabaseConfigured as jest.Mock;
const mockGetResolvedSupabaseConfig = supabaseClient.getResolvedSupabaseConfig as jest.Mock;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetResolvedSupabaseConfig.mockReturnValue({
      url: 'https://mock.supabase.co',
      anonKey: 'mock-key',
      source: 'process.env',
      error: null,
    });
  });

  it('retorna user id da sessao atual', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
      error: null,
    });

    await expect(getCurrentUserId()).resolves.toBe('user-123');
  });

  it('lanca erro quando nao ha usuario autenticado', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(getCurrentUserId()).rejects.toThrow('User not authenticated');
  });

  it('remove sessao local ao fazer logout', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await authService.logout();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith('supabase.auth.token');
  });

  it('traduz erro de resposta HTML inesperada no login', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSignInWithPassword.mockRejectedValue(new Error('JSON Parse error: Unexpected character: <'));

    await expect(
      authService.login({ email: 'user@example.com', password: 'secret' })
    ).rejects.toThrow('Falha de configuracao do servidor de autenticacao');

    consoleErrorSpy.mockRestore();
  });

  it('retorna erro especifico quando URL do Supabase esta ausente', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    mockGetResolvedSupabaseConfig.mockReturnValue({
      url: null,
      anonKey: 'mock-key',
      source: 'missing',
      error: 'missing_url',
    });

    await expect(
      authService.login({ email: 'user@example.com', password: 'secret' })
    ).rejects.toThrow('EXPO_PUBLIC_SUPABASE_URL');
  });

  it('retorna erro especifico quando URL do Supabase e invalida', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    mockGetResolvedSupabaseConfig.mockReturnValue({
      url: 'http://bad-host',
      anonKey: 'mock-key',
      source: 'process.env',
      error: 'invalid_url',
    });

    await expect(
      authService.login({ email: 'user@example.com', password: 'secret' })
    ).rejects.toThrow('Configuração inválida do Supabase');
  });
});
