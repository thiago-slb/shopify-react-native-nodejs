import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAbstractFetchFunc } from '@shopify/shopify-api/runtime';
import { ShopifyAdminClient } from '../src/modules/shopify/infra/shopify-admin-client.js';
import { testConfig } from './test-helpers.js';

function createResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function stubShopifyFetch(fetchMock: typeof fetch): void {
  vi.stubGlobal('fetch', fetchMock);
  setAbstractFetchFunc(fetchMock);
}

describe('ShopifyAdminClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAbstractFetchFunc(globalThis.fetch);
    vi.useRealTimers();
  });

  it('uses the Shopify Admin GraphQL endpoint and access token header', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createResponse({ data: { ok: true } }));
    stubShopifyFetch(fetchMock);

    const client = new ShopifyAdminClient(testConfig);

    await expect(client.request('query Test { ok }', {})).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.myshopify.com/admin/api/2025-01/graphql.json');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': 'test-token'
    });
  });

  it('retries retriable reads with bounded attempts', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(createResponse({ data: { ok: true } }));
    stubShopifyFetch(fetchMock);

    const client = new ShopifyAdminClient({
      ...testConfig,
      SHOPIFY_ADMIN_READ_RETRIES: 1
    });

    await expect(client.request('query Test { ok }', {}, { retriable: true })).resolves.toEqual({
      ok: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retriable cart mutations', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'));
    stubShopifyFetch(fetchMock);

    const client = new ShopifyAdminClient({
      ...testConfig,
      SHOPIFY_ADMIN_READ_RETRIES: 2
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
    stubShopifyFetch(fetchMock);

    const client = new ShopifyAdminClient({
      ...testConfig,
      SHOPIFY_ADMIN_TIMEOUT_MS: 1,
      SHOPIFY_ADMIN_READ_RETRIES: 0
    });

    await expect(client.request('query Test { ok }', {}, { retriable: true })).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT'
    });
  });

  it('opens the circuit after repeated upstream failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'));
    stubShopifyFetch(fetchMock);

    const client = new ShopifyAdminClient({
      ...testConfig,
      SHOPIFY_ADMIN_READ_RETRIES: 0,
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
