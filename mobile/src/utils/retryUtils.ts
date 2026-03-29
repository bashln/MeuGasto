/**
 * Utilitário para retry de operações assíncronas com exponential backoff.
 * Útil para operações de rede que podem falhar transientemente.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'network',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    'fetch',
    'Failed to fetch',
  ],
};

/**
 * Verifica se um erro é passível de retry
 */
export const isRetryableError = (error: unknown, retryableErrors: string[]): boolean => {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryable => 
      errorMessage.includes(retryable.toLowerCase())
    );
  }
  return false;
};

/**
 * Delay com exponential backoff e jitter
 */
const delay = (ms: number): Promise<void> => {
  // Adiciona jitter aleatório (±25%) para evitar thundering herd
  const jitter = ms * 0.25;
  const actualDelay = ms + (Math.random() * 2 - 1) * jitter;
  return new Promise(resolve => setTimeout(resolve, actualDelay));
};

/**
 * Executa uma função assíncrona com retry automático
 * 
 * @param fn - Função a ser executada
 * @param options - Opções de retry
 * @returns Resultado da função
 * @throws Último erro após todas as tentativas
 * 
 * @example
 * const data = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Última tentativa falhou, não faz retry
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Só faz retry para erros passíveis de retry
      if (!isRetryableError(error, config.retryableErrors)) {
        throw error;
      }
      
      // Calcula delay com exponential backoff
      const currentDelay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );
      
      if (__DEV__) {
        console.warn(
          `[withRetry] Tentativa ${attempt + 1}/${config.maxRetries + 1} falhou. ` +
          `Retry em ${currentDelay}ms...`,
          error
        );
      }
      
      await delay(currentDelay);
    }
  }
  
  throw lastError;
}

/**
 * Decorator para adicionar retry automaticamente a métodos de service
 * 
 * @example
 * class MyService {
 *   @retryable()
 *   async fetchData() {
 *     return api.get('/data');
 *   }
 * }
 */
export function retryable(options: RetryOptions = {}) {
  return function <T>(
    target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>>
  ): void {
    const originalMethod = descriptor.value;
    
    if (!originalMethod) {
      return;
    }
    
    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<T> {
      return withRetry(
        () => originalMethod.apply(this, args),
        options
      );
    };
  };
}
