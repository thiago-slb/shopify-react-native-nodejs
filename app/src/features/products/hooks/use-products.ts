import { useQuery } from '@tanstack/react-query';
import { getProducts } from '../api/products-api';

export function useProducts(query: string) {
  return useQuery({
    queryKey: ['products', { query, first: 20 }],
    queryFn: () => getProducts({ query, first: 20 }),
    staleTime: 30_000
  });
}
