import { useQuery } from '@tanstack/react-query';
import { getOrders } from '../api/orders-api';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    staleTime: 60_000
  });
}
