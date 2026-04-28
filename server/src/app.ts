import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import type { AppConfig } from './config/env.js';
import { loadConfig } from './config/env.js';
import { DemoOrdersService } from './modules/shopify/application/demo-orders-service.js';
import { ShopifyService } from './modules/shopify/application/shopify-service.js';
import { ShopifyStorefrontRepository } from './modules/shopify/infra/shopify-storefront-repository.js';
import { ShopifyStorefrontClient } from './modules/shopify/infra/storefront-client.js';
import { registerShopifyRoutes } from './modules/shopify/presentation/shopify-routes.js';
import { RateLimitedError } from './shared/errors/app-error.js';
import { errorHandler } from './shared/http/error-handler.js';
import { notFoundHandler } from './shared/http/validation.js';
import { loggerOptions } from './shared/logger/logger.js';

export type BuildAppOptions = {
  config?: AppConfig;
  shopifyService?: ShopifyService;
};

function corsOrigin(origin: string): string | string[] | boolean {
  if (origin === '*') {
    return true;
  }

  if (origin.includes(',')) {
    return origin
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return origin;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const redis = config.RATE_LIMIT_REDIS_URL ? new Redis(config.RATE_LIMIT_REDIS_URL) : undefined;
  const fastify = Fastify({
    logger: loggerOptions(config),
    trustProxy: true,
    bodyLimit: config.BODY_LIMIT_BYTES,
    ajv: {
      customOptions: {
        removeAdditional: false
      }
    }
  });

  if (redis) {
    fastify.addHook('onClose', () => {
      redis.disconnect();
    });
  }

  const shopifyService =
    options.shopifyService ??
    new ShopifyService(new ShopifyStorefrontRepository(new ShopifyStorefrontClient(config)));
  const demoOrdersService = new DemoOrdersService();

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  await fastify.register(cors, {
    origin: corsOrigin(config.CORS_ORIGIN),
    credentials: config.CORS_ORIGIN !== '*'
  });

  await fastify.register(rateLimit, {
    global: false,
    ...(redis ? { redis } : {}),
    keyGenerator: (request) => {
      const sessionId = request.headers['x-session-id'];
      return typeof sessionId === 'string' && sessionId.trim() ? sessionId : request.ip;
    },
    errorResponseBuilder: (_request, context) =>
      new RateLimitedError('Rate limit exceeded', {
        limit: context.max,
        retryAfter: context.after
      }),
    onExceeded: (request, key) => {
      request.log.warn(
        { metric: 'rate_limit.limited_request', key, route: request.routeOptions.url },
        'Request rate limited'
      );
    }
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Shopify React Native Backend',
        description: 'Backend API for a React Native Shopify Storefront integration.',
        version: '0.1.0'
      }
    }
  });

  if (config.API_DOCS_ENABLED) {
    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true
      }
    });
  }

  fastify.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            required: ['status'],
            properties: {
              status: { type: 'string' }
            }
          }
        }
      }
    },
    () => ({ status: 'ok' })
  );

  await fastify.register(
    (api, _options, done) => {
      registerShopifyRoutes(api, shopifyService);
      api.get(
        '/orders',
        {
          schema: {
            tags: ['Orders'],
            response: {
              200: {
                type: 'object',
                required: ['items', 'limitation'],
                properties: {
                  items: { type: 'array' },
                  limitation: { type: 'string' }
                }
              }
            }
          }
        },
        () => demoOrdersService.listOrders()
      );
      api.get('/orders/:orderId', (request) => {
        const { orderId } = request.params as { orderId: string };
        return demoOrdersService.getOrder(orderId);
      });
      api.post('/orders/:orderId/rebuy', (request) => {
        const { orderId } = request.params as { orderId: string };
        return demoOrdersService.rebuyOrder(orderId);
      });
      done();
    },
    { prefix: '/api' }
  );

  return fastify;
}
