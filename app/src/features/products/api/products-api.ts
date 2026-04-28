import { apiRequest } from '@/src/shared/api/client';
import type { ProductsResponse } from '../types/product';

type GetProductsParams = {
  query?: string;
  first?: number;
  after?: string;
};

export function getProducts({ query, first = 20, after }: GetProductsParams): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  params.set('first', String(first));

  if (query) {
    params.set('query', query);
  }

  if (after) {
    params.set('after', after);
  }

  return apiRequest<ProductsResponse>(`/api/products?${params.toString()}`);
}
