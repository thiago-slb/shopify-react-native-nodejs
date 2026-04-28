import { describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../src/shared/errors/app-error.js';
import type { ShopifyRepository } from '../src/modules/shopify/application/shopify-repository.js';
import { ShopifyService } from '../src/modules/shopify/application/shopify-service.js';
import { cartFixture, productFixture } from './test-helpers.js';

function createRepository(overrides: Partial<ShopifyRepository> = {}): ShopifyRepository {
  return {
    listProducts: vi.fn().mockResolvedValue({
      items: [productFixture],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        previousPageToken: null,
        nextPageToken: null
      }
    }),
    getProductByHandle: vi.fn().mockResolvedValue(productFixture),
    createCart: vi.fn().mockResolvedValue(cartFixture),
    getCart: vi.fn().mockResolvedValue(cartFixture),
    addCartLines: vi.fn().mockResolvedValue(cartFixture),
    updateCartLines: vi.fn().mockResolvedValue(cartFixture),
    removeCartLines: vi.fn().mockResolvedValue(cartFixture),
    ...overrides
  };
}

describe('ShopifyService', () => {
  it('uses a production-friendly default page size for product lists', async () => {
    const listProducts = vi.fn().mockResolvedValue({
      items: [productFixture],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        previousPageToken: null,
        nextPageToken: null
      }
    });
    const repository = createRepository({ listProducts });
    const service = new ShopifyService(repository);

    await service.listProducts({});

    expect(listProducts).toHaveBeenCalledWith({
      first: 20,
      pageToken: undefined,
      query: undefined
    });
  });

  it('throws a domain not found error when a product handle is missing', async () => {
    const service = new ShopifyService(
      createRepository({
        getProductByHandle: vi.fn().mockResolvedValue(null)
      })
    );

    await expect(service.getProductByHandle('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns only the checkout URL for checkout requests', async () => {
    const service = new ShopifyService(createRepository());

    await service.createCart('session-1', []);

    await expect(service.getCheckoutUrl('session-1', cartFixture.cartId)).resolves.toEqual({
      checkoutUrl: cartFixture.checkoutUrl
    });
  });
});
