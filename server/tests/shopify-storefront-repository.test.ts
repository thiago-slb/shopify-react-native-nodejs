import { describe, expect, it, vi } from 'vitest';
import { encodePublicId } from '../src/modules/shopify/application/public-id.js';
import { ShopifyStorefrontRepository } from '../src/modules/shopify/infra/shopify-storefront-repository.js';
import { UpstreamUnavailableError } from '../src/shared/errors/app-error.js';
import type { ShopifyStorefrontClient } from '../src/modules/shopify/infra/storefront-client.js';

function createClient(response: unknown): ShopifyStorefrontClient {
  return {
    request: vi.fn().mockResolvedValue(response)
  } as unknown as ShopifyStorefrontClient;
}

const shopifyCart = {
  id: 'gid://shopify/Cart/1',
  checkoutUrl: 'https://checkout.example',
  totalQuantity: 1,
  lines: {
    edges: [
      {
        node: {
          id: 'gid://shopify/CartLine/1',
          quantity: 1,
          cost: { totalAmount: { amount: '19.99', currencyCode: 'USD' } },
          merchandise: {
            id: 'gid://shopify/ProductVariant/1',
            title: 'Small',
            price: { amount: '19.99', currencyCode: 'USD' },
            image: null,
            product: {
              id: 'gid://shopify/Product/1',
              title: 'Test T-Shirt',
              handle: 'test-t-shirt'
            }
          }
        }
      }
    ]
  },
  cost: {
    subtotalAmount: { amount: '19.99', currencyCode: 'USD' },
    totalAmount: { amount: '19.99', currencyCode: 'USD' },
    totalTaxAmount: null
  }
};

const shopifyProduct = {
  id: 'gid://shopify/Product/1',
  title: 'Test T-Shirt',
  handle: 'test-t-shirt',
  description: 'A test product',
  availableForSale: true,
  images: {
    edges: [
      {
        node: {
          url: 'https://cdn.shopify.com/test-shirt.jpg',
          altText: 'Test shirt',
          width: 800,
          height: 800
        }
      }
    ]
  },
  priceRange: {
    minVariantPrice: { amount: '19.99', currencyCode: 'USD' },
    maxVariantPrice: { amount: '29.99', currencyCode: 'USD' }
  },
  variants: {
    edges: [
      {
        node: {
          id: 'gid://shopify/ProductVariant/1',
          title: 'Small',
          availableForSale: true,
          quantityAvailable: 10,
          price: { amount: '19.99', currencyCode: 'USD' },
          selectedOptions: [{ name: 'Size', value: 'S' }],
          image: null
        }
      }
    ]
  }
};

describe('ShopifyStorefrontRepository', () => {
  it('normalizes cartCreate responses into app DTOs', async () => {
    const repository = new ShopifyStorefrontRepository(
      createClient({
        cartCreate: {
          cart: shopifyCart,
          userErrors: []
        }
      })
    );

    const cart = await repository.createCart([
      { variantId: encodePublicId('variant', 'gid://shopify/ProductVariant/1'), quantity: 1 }
    ]);

    expect(cart).toMatchObject({
      cartId: encodePublicId('cart', 'gid://shopify/Cart/1'),
      checkoutUrl: 'https://checkout.example',
      lines: [{ merchandise: { product: { handle: 'test-t-shirt' } } }]
    });
  });

  it('rejects malformed public pagination tokens before calling Shopify', async () => {
    const request = vi.fn().mockResolvedValue({});
    const client = { request } as unknown as ShopifyStorefrontClient;
    const repository = new ShopifyStorefrontRepository(client);

    await expect(repository.listProducts({ pageToken: 'not-a-token' })).rejects.toMatchObject({
      code: 'INVALID_PAGE_TOKEN'
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('caches product list responses by query shape and exposes cache metrics', async () => {
    const request = vi.fn().mockResolvedValue({
      products: {
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null
        },
        edges: [{ node: shopifyProduct }]
      }
    });
    const client = { request } as unknown as ShopifyStorefrontClient;
    const repository = new ShopifyStorefrontRepository(client, {
      PRODUCT_CACHE_TTL_MS: 60_000,
      PRODUCT_LIST_IMAGE_LIMIT: 2,
      PRODUCT_LIST_VARIANT_LIMIT: 3
    });

    await repository.listProducts({ first: 10, query: 'shirt' });
    await repository.listProducts({ first: 10, query: 'shirt' });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ first: 10, query: 'shirt', imageLimit: 2, variantLimit: 3 }),
      { retriable: true }
    );
    expect(repository.getCatalogCacheMetrics()).toMatchObject({ hits: 1, misses: 1 });
  });

  it('serves stale product lists when the Shopify circuit is open', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        products: {
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          },
          edges: [{ node: shopifyProduct }]
        }
      })
      .mockRejectedValueOnce(new UpstreamUnavailableError('Circuit open'));
    const client = { request } as unknown as ShopifyStorefrontClient;
    const repository = new ShopifyStorefrontRepository(client, {
      PRODUCT_CACHE_TTL_MS: 1,
      PRODUCT_CACHE_STALE_MS: 60_000
    });

    const fresh = await repository.listProducts({ first: 10 });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const stale = await repository.listProducts({ first: 10 });

    expect(stale).toEqual(fresh);
    expect(repository.getCatalogCacheMetrics()).toMatchObject({ staleHits: 1 });
  });

  it.each([
    [
      'QUANTITY_UNAVAILABLE',
      { field: ['lines', '0', 'quantity'], message: 'Quantity is not available', code: 'INVALID' }
    ],
    ['INVALID_VARIANT', { field: ['lines', '0', 'merchandiseId'], message: 'Variant is invalid' }],
    ['CART_EXPIRED', { field: ['cartId'], message: 'Cart is expired' }],
    ['CART_LINE_UNAVAILABLE', { field: ['lines', '0', 'id'], message: 'Line was not found' }]
  ])('maps Shopify userErrors to %s', async (code, userError) => {
    const repository = new ShopifyStorefrontRepository(
      createClient({
        cartLinesAdd: {
          cart: null,
          userErrors: [userError]
        }
      })
    );

    await expect(
      repository.addCartLines('gid://shopify/Cart/1', [
        { variantId: encodePublicId('variant', 'gid://shopify/ProductVariant/1'), quantity: 99 }
      ])
    ).rejects.toMatchObject({
      code
    });
  });
});
