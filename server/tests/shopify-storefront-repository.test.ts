import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../src/shared/errors/app-error.js';
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
      { merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1 }
    ]);

    expect(cart).toMatchObject({
      id: 'gid://shopify/Cart/1',
      checkoutUrl: 'https://checkout.example',
      lines: [{ merchandise: { product: { handle: 'test-t-shirt' } } }]
    });
  });

  it('turns Shopify userErrors into a bad request error', async () => {
    const repository = new ShopifyStorefrontRepository(
      createClient({
        cartLinesAdd: {
          cart: null,
          userErrors: [
            {
              field: ['lines', '0', 'quantity'],
              message: 'Quantity is not available',
              code: 'INVALID'
            }
          ]
        }
      })
    );

    await expect(
      repository.addCartLines('gid://shopify/Cart/1', [
        { merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 99 }
      ])
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
