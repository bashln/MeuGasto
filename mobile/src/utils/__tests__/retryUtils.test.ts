import { withRetry, isRetryableError } from '../retryUtils';

describe('retryUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withRetry', () => {
    it('retorna resultado em caso de sucesso na primeira tentativa', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retry em caso de erro passível de retry', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(fn, { maxRetries: 3, initialDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('lança erro após todas as tentativas falharem', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('network error'));
      
      await expect(withRetry(fn, { maxRetries: 2, initialDelay: 10 }))
        .rejects.toThrow('network error');
      
      expect(fn).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    });

    it('não retry para erros não passíveis de retry', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('validation error'));
      
      await expect(withRetry(fn, { maxRetries: 3, initialDelay: 10 }))
        .rejects.toThrow('validation error');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetryableError', () => {
    it('retorna true para erros de rede', () => {
      expect(isRetryableError(new Error('network error'), ['network'])).toBe(true);
      expect(isRetryableError(new Error('connection timeout'), ['timeout'])).toBe(true);
    });

    it('retorna false para erros não relacionados', () => {
      expect(isRetryableError(new Error('validation failed'), ['network'])).toBe(false);
    });
  });
});
