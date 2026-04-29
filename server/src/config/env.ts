import 'dotenv/config';
import { z } from 'zod';

const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    CORS_ORIGIN: z.string().default('*'),
    API_DOCS_ENABLED: booleanEnvSchema.optional(),
    BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576),
    RATE_LIMIT_REDIS_URL: z.string().url().optional(),
    SHOPIFY_CLIENT_ID: z.string().min(1),
    SHOPIFY_CLIENT_SECRET: z.string().min(1),
    SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1),
    SHOPIFY_API_VERSION: z
      .enum(['2024-10', '2025-01', '2025-04', '2025-07', '2025-10', '2026-01', '2026-04'])
      .default('2026-04'),
    SHOPIFY_APP_HOST_NAME: z.string().min(1).default('localhost'),
    SHOPIFY_ADMIN_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    SHOPIFY_ADMIN_READ_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
    SHOPIFY_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
    SHOPIFY_CIRCUIT_OPEN_MS: z.coerce.number().int().positive().default(30_000),
    PRODUCT_CACHE_TTL_MS: z.coerce.number().int().positive().default(30_000),
    PRODUCT_CACHE_STALE_MS: z.coerce.number().int().positive().default(300_000),
    PRODUCT_LIST_IMAGE_LIMIT: z.coerce.number().int().min(0).max(10).default(1),
    PRODUCT_LIST_VARIANT_LIMIT: z.coerce.number().int().min(1).max(100).default(20),
    PRODUCT_DETAIL_IMAGE_LIMIT: z.coerce.number().int().min(0).max(20).default(10),
    PRODUCT_DETAIL_VARIANT_LIMIT: z.coerce.number().int().min(1).max(250).default(100),
    SHOPIFY_STORE_DOMAIN: z.string().min(1)
  })
  .transform((config) => ({
    ...config,
    API_DOCS_ENABLED: config.API_DOCS_ENABLED ?? config.NODE_ENV !== 'production'
  }));

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const config = parsed.data;

  if (config.NODE_ENV === 'production' && config.CORS_ORIGIN.trim() === '*') {
    throw new Error('Invalid environment configuration: CORS_ORIGIN cannot be * in production');
  }

  return config;
}
