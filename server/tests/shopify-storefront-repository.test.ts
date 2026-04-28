import { describe, expect, it, vi } from 'vitest';
import { encodePublicId } from '../src/modules/shopify/application/public-id.js';
import { ShopifyStorefrontRepository } from '../src/modules/shopify/infra/shopify-storefront-repository.js';
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
