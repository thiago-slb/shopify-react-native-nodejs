import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopifyStorefrontClient } from '../src/modules/shopify/infra/storefront-client.js';
import { testConfig } from './test-helpers.js';

function createResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('ShopifyStorefrontClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('retries retriable reads with bounded attempts', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(createResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ShopifyStorefrontClient({
      ...testConfig,
      SHOPIFY_STOREFRONT_READ_RETRIES: 1
    });

    await expect(client.request('query Test { ok }', {}, { retriable: true })).resolves.toEqual({
      ok: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retriable cart mutations', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ShopifyStorefrontClient({
      ...testConfig,
      SHOPIFY_STOREFRONT_READ_RETRIES: 2
    });

    await expect(client.request('mutation CartCreate { cartCreate }', {})).rejects.toMatchObject({
      code: 'UPSTREAM_SERVICE_ERROR'
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts slow Shopify requests with a stable timeout error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ShopifyStorefrontClient({
      ...testConfig,
      SHOPIFY_STOREFRONT_TIMEOUT_MS: 1,
      SHOPIFY_STOREFRONT_READ_RETRIES: 0
    });

    await expect(client.request('query Test { ok }', {}, { retriable: true })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT'
    });
  });

  it('opens the circuit after repeated upstream failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ShopifyStorefrontClient({
      ...testConfig,
      SHOPIFY_STOREFRONT_READ_RETRIES: 0,
      SHOPIFY_CIRCUIT_FAILURE_THRESHOLD: 1,
      SHOPIFY_CIRCUIT_OPEN_MS: 30_000
    });

    await expect(client.request('query Test { ok }', {}, { retriable: true })).rejects.toMatchObject({
      code: 'UPSTREAM_SERVICE_ERROR'
    });
    await expect(client.request('mutation CartCreate { cartCreate }', {})).rejects.toMatchObject({
      code: 'SHOPIFY_UNAVAILABLE'
    });
    expect(client.getCircuitBreakerState()).toMatchObject({ state: 'open', failures: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
