import type { FastifyInstance } from 'fastify';
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

export function registerShopifyRoutes(fastify: FastifyInstance, service: ShopifyService): void {
  fastify.get(
    '/products',
    {
      schema: {
        tags: ['Products'],
        querystring: {
          type: 'object',
          properties: {
            first: { type: 'integer', minimum: 1, maximum: 50 },
            after: { type: 'string' },
            query: { type: 'string' }
          }
        },
        response: {
          200: productsResponseSchema,
          400: errorResponseSchema,
          502: errorResponseSchema
        }
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
          properties: {
            handle: { type: 'string' }
          }
        },
        response: {
          200: productResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema
        }
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
          502: errorResponseSchema
        }
      }
    },
    async (request) => {
      const { lines } = parseRequestPart(cartLinesBodySchema, request.body);
      return service.createCart(lines);
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
          properties: { cartId: { type: 'string' } }
        },
        response: {
          200: cartResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema
        }
      }
    },
    async (request) => {
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      return service.getCart(cartId);
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
          properties: { cartId: { type: 'string' } }
        },
        body: cartLinesBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema
        }
      }
    },
    async (request) => {
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      const { lines } = parseRequestPart(cartLinesBodySchema, request.body);
      return service.addCartLines(cartId, lines);
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
          properties: { cartId: { type: 'string' } }
        },
        body: cartLinesUpdateBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema
        }
      }
    },
    async (request) => {
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      const { lines } = parseRequestPart(cartLinesUpdateBodySchema, request.body);
      return service.updateCartLines(cartId, lines);
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
          properties: { cartId: { type: 'string' } }
        },
        body: cartLinesRemoveBodyJsonSchema,
        response: {
          200: cartResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema
        }
      }
    },
    async (request) => {
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      const { lineIds } = parseRequestPart(cartLinesRemoveBodySchema, request.body);
      return service.removeCartLines(cartId, lineIds);
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
          properties: { cartId: { type: 'string' } }
        },
        response: {
          200: checkoutUrlResponseSchema,
          404: errorResponseSchema,
          502: errorResponseSchema
        }
      }
    },
    async (request) => {
      const { cartId } = parseRequestPart(cartParamsSchema, request.params);
      return service.getCheckoutUrl(cartId);
    }
  );
}
