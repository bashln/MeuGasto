import { usePagination } from './usePagination';
import { Purchase } from '../types';

export function usePurchasePagination() {
  return usePagination<Purchase>(20);
}
