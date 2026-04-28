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
    SHOPIFY_STOREFRONT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    SHOPIFY_STOREFRONT_READ_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
    SHOPIFY_STORE_DOMAIN: z.string().min(1),
    SHOPIFY_STOREFRONT_ACCESS_TOKEN: z.string().min(1),
    SHOPIFY_STOREFRONT_API_VERSION: z.string().min(1).default('2025-01')
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
