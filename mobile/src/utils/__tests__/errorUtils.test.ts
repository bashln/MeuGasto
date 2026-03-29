import { getErrorMessage, isError } from '../errorUtils';

describe('errorUtils', () => {
  describe('getErrorMessage', () => {
    it('extrai mensagem de instância Error', () => {
      const error = new Error('Mensagem de erro');
      expect(getErrorMessage(error)).toBe('Mensagem de erro');
    });

    it('retorna string quando erro é uma string', () => {
      expect(getErrorMessage('Erro string')).toBe('Erro string');
    });

    it('extrai mensagem de objeto com propriedade message', () => {
      const errorObj = { message: 'Erro do objeto' };
      expect(getErrorMessage(errorObj)).toBe('Erro do objeto');
    });

    it('retorna fallback para null', () => {
      expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado');
    });

    it('retorna fallback para undefined', () => {
      expect(getErrorMessage(undefined)).toBe('Ocorreu um erro inesperado');
    });

    it('retorna fallback para número', () => {
      expect(getErrorMessage(404)).toBe('Ocorreu um erro inesperado');
    });

    it('retorna fallback personalizado quando especificado', () => {
      expect(getErrorMessage(null, 'Erro customizado')).toBe('Erro customizado');
    });

    it('retorna fallback para objeto sem message', () => {
      expect(getErrorMessage({ code: 500 })).toBe('Ocorreu um erro inesperado');
    });
  });

  describe('isError', () => {
    it('retorna true para instância Error', () => {
      expect(isError(new Error('test'))).toBe(true);
    });

    it('retorna false para string', () => {
      expect(isError('erro')).toBe(false);
    });

    it('retorna false para null', () => {
      expect(isError(null)).toBe(false);
    });

    it('retorna true para objeto com message', () => {
      expect(isError({ message: 'erro' })).toBe(true);
    });
  });
});
