jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
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
  },
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { authService, getCurrentUserId } from '../authService';
import { supabase } from '../../lib/supabaseClient';
import * as SecureStore from 'expo-secure-store';

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
