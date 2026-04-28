import type { FastifyInstance } from 'fastify';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import { errorResponseSchema } from '../../../shared/schemas/openapi.js';
import { parseRequestPart } from '../../../shared/http/validation.js';
import type { ShopifyService } from '../application/shopify-service.js';
import {
  cartLinesBodyJsonSchema,
  cartLinesBodySchema,
  cartLinesRemoveBodyJsonSchema,
  cartLinesRemoveBodySchema,
  cartLinesUpdateBodyJsonSchema,
  cartLinesUpdateBodySchema,
  cartParamsSchema,
  cartResponseSchema,
  checkoutUrlResponseSchema,
  handleParamsSchema,
  productListQuerySchema,
  productResponseSchema,
  productsResponseSchema
} from './shopify-schemas.js';

const catalogRateLimit = { max: 60, timeWindow: '1 minute', groupId: 'catalog' };
const cartReadRateLimit = { max: 60, timeWindow: '1 minute', groupId: 'cart-read' };
const cartMutationRateLimit = { max: 20, timeWindow: '1 minute', groupId: 'cart-mutation' };
const checkoutRateLimit = { max: 10, timeWindow: '1 minute', groupId: 'checkout' };

function requireSessionId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const sessionId = request.headers['x-session-id'];
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new UnauthorizedError('x-session-id header is required for cart operations');
  }

  return sessionId.trim();
}

export function registerShopifyRoutes(fastify: FastifyInstance, service: ShopifyService): void {
  fastify.get(
    '/products',
    {
      schema: {
        tags: ['Products'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            first: { type: 'integer', minimum: 1, maximum: 50 },
            pageToken: { type: 'string', maxLength: 2000 },
            after: { type: 'string', maxLength: 2000 },
            query: { type: 'string', maxLength: 500 }
          }
        },
        response: {
          200: productsResponseSchema,
          400: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: catalogRateLimit
      }
    },
    async (request) => service.listProducts(parseRequestPart(productListQuerySchema, request.query))
  );

  fastify.get(
    '/products/:handle',
    {
      schema: {
        tags: ['Products'],
        params: {
          type: 'object',
          required: ['handle'],
          additionalProperties: false,
          properties: {
            handle: { type: 'string', maxLength: 255 }
          }
        },
        response: {
          200: productResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: catalogRateLimit
      }
    },
    async (request) => {
      const { handle } = parseRequestPart(handleParamsSchema, request.params);
      return service.getProductByHandle(handle);
    }
  );

  fastify.post(
    '/cart',
    {
      schema: {
        tags: ['Cart'],
        body: cartLinesBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: cartMutationRateLimit
      }
    },
    async (request) => {
      const sessionId = requireSessionId(request);
      const { lines } = parseRequestPart(cartLinesBodySchema, request.body);
      return service.createCart(sessionId, lines);
    }
  );

  fastify.get(
    '/cart/:cartId',
    {
      schema: {
        tags: ['Cart'],
        params: {
          type: 'object',
          required: ['cartId'],
          additionalProperties: false,
          properties: { cartId: { type: 'string', maxLength: 2000 } }
        },
        response: {
          200: cartResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: cartReadRateLimit
      }
    },
    async (request) => {
      const sessionId = requireSessionId(request);
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      return service.getCart(sessionId, cartId);
    }
  );

  fastify.post(
    '/cart/:cartId/lines',
    {
      schema: {
        tags: ['Cart'],
        params: {
          type: 'object',
          required: ['cartId'],
          additionalProperties: false,
          properties: { cartId: { type: 'string', maxLength: 2000 } }
        },
        body: cartLinesBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: cartMutationRateLimit
      }
    },
    async (request) => {
      const sessionId = requireSessionId(request);
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      const { lines } = parseRequestPart(cartLinesBodySchema, request.body);
      return service.addCartLines(sessionId, cartId, lines);
    }
  );

  fastify.patch(
    '/cart/:cartId/lines',
    {
      schema: {
        tags: ['Cart'],
        params: {
          type: 'object',
          required: ['cartId'],
          additionalProperties: false,
          properties: { cartId: { type: 'string', maxLength: 2000 } }
        },
        body: cartLinesUpdateBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: cartMutationRateLimit
      }
    },
    async (request) => {
      const sessionId = requireSessionId(request);
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      const { lines } = parseRequestPart(cartLinesUpdateBodySchema, request.body);
      return service.updateCartLines(sessionId, cartId, lines);
    }
  );

  fastify.delete(
    '/cart/:cartId/lines',
    {
      schema: {
        tags: ['Cart'],
        params: {
          type: 'object',
          required: ['cartId'],
          additionalProperties: false,
          properties: { cartId: { type: 'string', maxLength: 2000 } }
        },
        body: cartLinesRemoveBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: cartMutationRateLimit
      }
    },
    async (request) => {
      const sessionId = requireSessionId(request);
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      const { cartLineIds } = parseRequestPart(cartLinesRemoveBodySchema, request.body);
      return service.removeCartLines(sessionId, cartId, cartLineIds);
    }
  );

  fastify.post(
    '/cart/:cartId/checkout',
    {
      schema: {
        tags: ['Cart'],
        params: {
          type: 'object',
          required: ['cartId'],
          additionalProperties: false,
          properties: { cartId: { type: 'string', maxLength: 2000 } }
        },
        response: {
          200: checkoutUrlResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
          502: errorResponseSchema
        }
      },
      config: {
        rateLimit: checkoutRateLimit
      }
    },
    async (request) => {
      const sessionId = requireSessionId(request);
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      return service.getCheckoutUrl(sessionId, cartId);
    }
  );
}
