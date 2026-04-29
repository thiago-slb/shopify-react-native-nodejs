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
        previousPageToken: null,
        nextPageToken: null
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
    expect(response.json()).toMatchObject({
      status: 'ok',
      shopifyAdminCircuitBreaker: { state: 'closed', failures: 0 },
      catalogCache: { hits: 0, staleHits: 0, misses: 0 }
    });
  });

  it('does not expose Swagger UI when API docs are disabled', async () => {
    app = await buildApp({
      config: { ...testConfig, API_DOCS_ENABLED: false },
      shopifyService: new ShopifyService(repository)
    });

    const response = await app.inject({ method: 'GET', url: '/docs' });

    expect(response.statusCode).toBe(404);
  });

  it('returns normalized product list responses', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({ method: 'GET', url: '/api/products?first=10' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ handle: 'test-t-shirt', variants: [{ variantId: productFixture.variants[0].variantId }] }]
    });
  });

  it('validates cart line payloads', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/cart',
      headers: { 'x-session-id': 'session-1' },
      payload: { lines: [{ merchandiseId: '', quantity: 0 }] }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' }
    });
  });

  it('rejects unknown cart payload fields', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/cart',
      headers: { 'x-session-id': 'session-1' },
      payload: {
        lines: [{ variantId: productFixture.variants[0].variantId, quantity: 1, unexpected: true }]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' }
    });
  });

  it('enforces the configured request body limit', async () => {
    app = await buildApp({
      config: { ...testConfig, BODY_LIMIT_BYTES: 64 },
      shopifyService: new ShopifyService(repository)
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/cart',
      headers: { 'x-session-id': 'session-1', 'content-type': 'application/json' },
      payload: JSON.stringify({
        lines: [{ variantId: productFixture.variants[0].variantId, quantity: 1 }]
      })
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' }
    });
  });

  it('requires a session for cart operations', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/cart',
      payload: { lines: [{ variantId: productFixture.variants[0].variantId, quantity: 1 }] }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: { code: 'AUTHENTICATION_REQUIRED' }
    });
  });

  it('returns checkout URL for a cart', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    await app.inject({
      method: 'POST',
      url: '/api/cart',
      headers: { 'x-session-id': 'session-1' },
      payload: { lines: [{ variantId: productFixture.variants[0].variantId, quantity: 1 }] }
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/cart/${encodeURIComponent(cartFixture.cartId)}/checkout`,
      headers: { 'x-session-id': 'session-1' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkoutUrl: cartFixture.checkoutUrl });
  });

  it('rejects cart access from another session', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    await app.inject({
      method: 'POST',
      url: '/api/cart',
      headers: { 'x-session-id': 'session-1' },
      payload: { lines: [{ variantId: productFixture.variants[0].variantId, quantity: 1 }] }
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/cart/${encodeURIComponent(cartFixture.cartId)}`,
      headers: { 'x-session-id': 'session-2' }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: { code: 'CART_OWNERSHIP_MISMATCH' }
    });
  });

  it('rate limits checkout URL creation with a stable error response', async () => {
    app = await buildApp({ config: testConfig, shopifyService: new ShopifyService(repository) });

    await app.inject({
      method: 'POST',
      url: '/api/cart',
      headers: { 'x-session-id': 'session-1' },
      payload: { lines: [{ variantId: productFixture.variants[0].variantId, quantity: 1 }] }
    });

    for (let index = 0; index < 10; index += 1) {
      await app.inject({
        method: 'POST',
        url: `/api/cart/${encodeURIComponent(cartFixture.cartId)}/checkout`,
        headers: { 'x-session-id': 'session-1' }
      });
    }

    const response = await app.inject({
      method: 'POST',
      url: `/api/cart/${encodeURIComponent(cartFixture.cartId)}/checkout`,
      headers: { 'x-session-id': 'session-1' }
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
    expect(response.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' }
    });
  });
});
