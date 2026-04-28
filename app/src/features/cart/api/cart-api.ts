import { apiRequest } from '@/src/shared/api/client';
import type { Cart, CartLineInput, CartLineUpdateInput, CheckoutResponse } from '../types/cart';

export function createCart(lines: CartLineInput[]): Promise<Cart> {
  return apiRequest<Cart>('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ lines })
  });
}

export function getCart(cartId: string): Promise<Cart> {
  return apiRequest<Cart>(`/api/cart/${encodeURIComponent(cartId)}`);
}

export function addCartLines(cartId: string, lines: CartLineInput[]): Promise<Cart> {
  return apiRequest<Cart>(`/api/cart/${encodeURIComponent(cartId)}/lines`, {
    method: 'POST',
    body: JSON.stringify({ lines })
  });
}

export function updateCartLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
  return apiRequest<Cart>(`/api/cart/${encodeURIComponent(cartId)}/lines`, {
    method: 'PATCH',
    body: JSON.stringify({ lines })
  });
}

export function removeCartLines(cartId: string, lineIds: string[]): Promise<Cart> {
  return apiRequest<Cart>(`/api/cart/${encodeURIComponent(cartId)}/lines`, {
    method: 'DELETE',
    body: JSON.stringify({ lineIds })
  });
}

export function getCheckoutUrl(cartId: string): Promise<CheckoutResponse> {
  return apiRequest<CheckoutResponse>(`/api/cart/${encodeURIComponent(cartId)}/checkout`, {
    method: 'POST'
  });
}
