import { NotFoundError } from '../../../shared/errors/app-error.js';
import type { Cart, CartLineInput, CartLineUpdateInput } from '../domain/cart.js';
import type { Product, ProductConnection, ProductListParams } from '../domain/product.js';
import type { ShopifyRepository } from './shopify-repository.js';

export class ShopifyService {
  constructor(private readonly repository: ShopifyRepository) {}

  async listProducts(params: ProductListParams): Promise<ProductConnection> {
    return this.repository.listProducts({
      first: params.first ?? 20,
      after: params.after,
      query: params.query
    });
  }

  async getProductByHandle(handle: string): Promise<Product> {
    const product = await this.repository.getProductByHandle(handle);
    if (!product) {
      throw new NotFoundError('Product not found', { handle });
    }

    return product;
  }

  async createCart(lines: CartLineInput[]): Promise<Cart> {
    return this.repository.createCart(lines);
  }

  async getCart(cartId: string): Promise<Cart> {
    const cart = await this.repository.getCart(cartId);
    if (!cart) {
      throw new NotFoundError('Cart not found', { cartId });
    }

    return cart;
  }

  async addCartLines(cartId: string, lines: CartLineInput[]): Promise<Cart> {
    return this.repository.addCartLines(cartId, lines);
  }

  async updateCartLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
    return this.repository.updateCartLines(cartId, lines);
  }

  async removeCartLines(cartId: string, lineIds: string[]): Promise<Cart> {
    return this.repository.removeCartLines(cartId, lineIds);
  }

  async getCheckoutUrl(cartId: string): Promise<{ checkoutUrl: string }> {
    const cart = await this.getCart(cartId);
    return { checkoutUrl: cart.checkoutUrl };
  }
}
