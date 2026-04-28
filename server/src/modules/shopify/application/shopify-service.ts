import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors/app-error.js';
import type { Cart, CartLineInput, CartLineUpdateInput } from '../domain/cart.js';
import type { Product, ProductConnection, ProductListParams } from '../domain/product.js';
import type { ShopifyRepository } from './shopify-repository.js';

export class ShopifyService {
  private readonly cartOwners = new Map<string, string>();
  private readonly cartMutationQueues = new Map<string, { tail: Promise<void>; depth: number }>();
  private readonly maxCartMutationQueueDepth = 10;

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
    return this.enqueueCartMutation(cartId, () => this.repository.addCartLines(cartId, lines));
  }

  async updateCartLines(ownerId: string, cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
    this.assertCartOwner(ownerId, cartId);
    return this.enqueueCartMutation(cartId, () => this.repository.updateCartLines(cartId, lines));
  }

  async removeCartLines(ownerId: string, cartId: string, cartLineIds: string[]): Promise<Cart> {
    this.assertCartOwner(ownerId, cartId);
    return this.enqueueCartMutation(cartId, () => this.repository.removeCartLines(cartId, cartLineIds));
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

  private async enqueueCartMutation<TValue>(
    cartId: string,
    operation: () => Promise<TValue>
  ): Promise<TValue> {
    const current = this.cartMutationQueues.get(cartId) ?? { tail: Promise.resolve(), depth: 0 };
    if (current.depth >= this.maxCartMutationQueueDepth) {
      throw new ConflictError('Cart mutation queue is full', { cartId }, 'CART_MUTATION_CONFLICT');
    }

    let release!: () => void;
    const nextTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.cartMutationQueues.set(cartId, {
      tail: current.tail.then(() => nextTail, () => nextTail),
      depth: current.depth + 1
    });

    await current.tail.catch(() => undefined);

    try {
      return await operation();
    } finally {
      release();
      const queued = this.cartMutationQueues.get(cartId);
      if (queued) {
        const depth = Math.max(0, queued.depth - 1);
        if (depth === 0) {
          this.cartMutationQueues.delete(cartId);
        } else {
          this.cartMutationQueues.set(cartId, { ...queued, depth });
        }
      }
    }
  }
}
