jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import {
  clearSupabaseSessionStorage,
  secureSessionStorage,
  SUPABASE_SESSION_STORAGE_KEY,
} from '../secureSessionStorage';

describe('secureSessionStorage', () => {
  const mockGetItemAsync = SecureStore.getItemAsync as jest.Mock;
  const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
  const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('le item com sucesso', async () => {
    mockGetItemAsync.mockResolvedValue('token');

    await expect(secureSessionStorage.getItem('k1')).resolves.toBe('token');
  });

  it('limpa chave de sessao do supabase', async () => {
    mockDeleteItemAsync.mockResolvedValue(undefined);

    await clearSupabaseSessionStorage();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith(SUPABASE_SESSION_STORAGE_KEY);
    expect(mockSetItemAsync).not.toHaveBeenCalled();
  });

  it('ativa fallback em memoria ao falhar leitura', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('boom'));

    await expect(secureSessionStorage.getItem('k2')).resolves.toBeNull();

    await secureSessionStorage.setItem('k2', 'from-memory');
    await expect(secureSessionStorage.getItem('k2')).resolves.toBe('from-memory');
    expect(mockSetItemAsync).not.toHaveBeenCalled();
  });
});
