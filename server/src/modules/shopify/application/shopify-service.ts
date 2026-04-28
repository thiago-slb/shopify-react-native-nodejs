import { ForbiddenError, NotFoundError } from '../../../shared/errors/app-error.js';
import type { Cart, CartLineInput, CartLineUpdateInput } from '../domain/cart.js';
import type { Product, ProductConnection, ProductListParams } from '../domain/product.js';
import type { ShopifyRepository } from './shopify-repository.js';

export class ShopifyService {
  private readonly cartOwners = new Map<string, string>();

  constructor(private readonly repository: ShopifyRepository) {}

  async listProducts(params: ProductListParams): Promise<ProductConnection> {
    return this.repository.listProducts({
      first: params.first ?? 20,
      pageToken: params.pageToken,
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

  async createCart(ownerId: string, lines: CartLineInput[]): Promise<Cart> {
    const cart = await this.repository.createCart(lines);
    this.cartOwners.set(cart.cartId, ownerId);
    return cart;
  }

  async getCart(ownerId: string, cartId: string): Promise<Cart> {
    this.assertCartOwner(ownerId, cartId);
    const cart = await this.repository.getCart(cartId);
    if (!cart) {
      throw new NotFoundError('Cart not found', { cartId });
    }

    return cart;
  }

  async addCartLines(ownerId: string, cartId: string, lines: CartLineInput[]): Promise<Cart> {
    this.assertCartOwner(ownerId, cartId);
    return this.repository.addCartLines(cartId, lines);
  }

  async updateCartLines(ownerId: string, cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
    this.assertCartOwner(ownerId, cartId);
    return this.repository.updateCartLines(cartId, lines);
  }

  async removeCartLines(ownerId: string, cartId: string, cartLineIds: string[]): Promise<Cart> {
    this.assertCartOwner(ownerId, cartId);
    return this.repository.removeCartLines(cartId, cartLineIds);
  }

  async getCheckoutUrl(ownerId: string, cartId: string): Promise<{ checkoutUrl: string }> {
    const cart = await this.getCart(ownerId, cartId);
    return { checkoutUrl: cart.checkoutUrl };
  }

  private assertCartOwner(ownerId: string, cartId: string): void {
    const knownOwnerId = this.cartOwners.get(cartId);
    if (!knownOwnerId || knownOwnerId !== ownerId) {
      throw new ForbiddenError('Cart does not belong to this session');
    }
  }
}
