/**
 * Extrai mensagem de erro de forma segura de qualquer tipo de erro.
 * Usado em catch blocks para normalizar mensagens de erro.
 * 
 * @param err - Qualquer valor que possa ser lançado como erro
 * @param fallbackMessage - Mensagem padrão caso não consiga extrair a mensagem do erro
 * @returns String com a mensagem de erro
 * 
 * @example
 * try {
 *   await someAsyncOperation();
 * } catch (err) {
 *   const message = getErrorMessage(err, 'Falha na operação');
 *   console.error(message);
 * }
 */
export const getErrorMessage = (err: unknown, fallbackMessage = 'Ocorreu um erro inesperado'): string => {
  if (err instanceof Error) {
    return err.message;
  }
  
  if (typeof err === 'string') {
    return err;
  }
  
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  
  return fallbackMessage;
};

/**
 * Verifica se um erro é uma instância de Error com propriedades esperadas.
 * Útil para type guards em tratamento de erros.
 * 
 * @param err - Valor a ser verificado
 * @returns Boolean indicando se é um erro válido
 */
export const isError = (err: unknown): err is Error => {
  return err instanceof Error || (
    typeof err === 'object' && 
    err !== null && 
    'message' in err &&
    typeof (err as Error).message === 'string'
  );
};
