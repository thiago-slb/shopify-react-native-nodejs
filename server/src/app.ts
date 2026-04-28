import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env.js';
import { loadConfig } from './config/env.js';
import { DemoOrdersService } from './modules/shopify/application/demo-orders-service.js';
import { ShopifyService } from './modules/shopify/application/shopify-service.js';
import { ShopifyStorefrontRepository } from './modules/shopify/infra/shopify-storefront-repository.js';
import { ShopifyStorefrontClient } from './modules/shopify/infra/storefront-client.js';
import { registerShopifyRoutes } from './modules/shopify/presentation/shopify-routes.js';
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
  const fastify = Fastify({
    logger: loggerOptions(config),
    trustProxy: true
  });

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

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Shopify React Native Backend',
        description: 'Backend API for a React Native Shopify Storefront integration.',
        version: '0.1.0'
      }
    }
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });

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
