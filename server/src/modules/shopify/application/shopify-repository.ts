import type { Cart, CartLineInput, CartLineUpdateInput } from '../domain/cart.js';
import type { Product, ProductConnection, ProductListParams } from '../domain/product.js';

export interface ShopifyRepository {
  listProducts(params: ProductListParams): Promise<ProductConnection>;
  getProductByHandle(handle: string): Promise<Product | null>;
  createCart(lines: CartLineInput[]): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
  addCartLines(cartId: string, lines: CartLineInput[]): Promise<Cart>;
  updateCartLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart>;
  removeCartLines(cartId: string, lineIds: string[]): Promise<Cart>;
}
