import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const requiredEnv = {
  SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
  SHOPIFY_CLIENT_ID: 'test-client-id',
  SHOPIFY_CLIENT_SECRET: 'test-client-secret',
  SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-token'
};

describe('environment config', () => {
  it('rejects wildcard CORS in production', () => {
    expect(() =>
      loadConfig({
        ...requiredEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: '*'
      })
    ).toThrow('CORS_ORIGIN cannot be * in production');
  });

  it('disables API docs by default in production', () => {
    expect(
      loadConfig({
        ...requiredEnv,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://shop.example'
      }).API_DOCS_ENABLED
    ).toBe(false);
  });
});
