import { apiRequest } from '@/src/shared/api/client';
import type { Order, OrdersResponse, RebuyResponse } from '../types/order';

export function getOrders(): Promise<OrdersResponse> {
  return apiRequest<OrdersResponse>('/api/orders');
}

export function getOrder(orderId: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${encodeURIComponent(orderId)}`);
}

export function rebuyOrder(orderId: string): Promise<RebuyResponse> {
  return apiRequest<RebuyResponse>(`/api/orders/${encodeURIComponent(orderId)}/rebuy`, {
    method: 'POST'
  });
}
