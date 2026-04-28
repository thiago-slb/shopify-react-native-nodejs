import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { ShopifyService } from '../src/modules/shopify/application/shopify-service.js';
import type { ShopifyRepository } from '../src/modules/shopify/application/shopify-repository.js';
import { cartFixture, productFixture, testConfig } from './test-helpers.js';

const repository: ShopifyRepository = {
  listProducts: () =>
    Promise.resolve({
      items: [productFixture],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null
      }
    }),
  getProductByHandle: () => Promise.resolve(productFixture),
  createCart: () => Promise.resolve(cartFixture),
  getCart: () => Promise.resolve(cartFixture),
  addCartLines: () => Promise.resolve(cartFixture),
  updateCartLines: () => Promise.resolve(cartFixture),
  removeCartLines: () => Promise.resolve(cartFixture)
};

describe('Shopify routes', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns health status', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns normalized product list responses', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({ method: 'GET', url: '/api/products?first=10' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ handle: 'test-t-shirt', variants: [{ id: 'gid://shopify/ProductVariant/1' }] }]
    });
  });

  it('validates cart line payloads', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/cart',
      payload: { lines: [{ merchandiseId: '', quantity: 0 }] }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' }
    });
  });

  it('returns checkout URL for a cart', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({
      method: 'POST',
      url: `/api/cart/${encodeURIComponent(cartFixture.id)}/checkout`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkoutUrl: cartFixture.checkoutUrl });
  });
});
