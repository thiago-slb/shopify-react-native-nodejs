import { z } from 'zod';

export const productListQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(50).optional(),
  pageToken: z.string().min(1).max(2000).optional(),
  after: z.string().min(1).max(2000).optional(),
  query: z.string().min(1).max(500).optional()
}).transform(({ after, pageToken, ...query }) => ({
  ...query,
  pageToken: pageToken ?? after
}));

export const handleParamsSchema = z.object({
  handle: z.string().min(1).max(255)
});

export const cartParamsSchema = z.object({
  cartId: z.string().min(1).max(2000)
});

export const cartLineInputSchema = z
  .object({
    variantId: z.string().min(1).max(2000).optional(),
    merchandiseId: z.string().min(1).max(2000).optional(),
    quantity: z.number().int().min(1)
  })
  .transform(({ variantId, merchandiseId, quantity }) => ({
    variantId: variantId ?? merchandiseId ?? '',
    quantity
  }))
  .pipe(
    z.object({
      variantId: z.string().min(1).max(2000),
      quantity: z.number().int().min(1)
    })
  );

export const cartLineUpdateInputSchema = z
  .object({
    cartLineId: z.string().min(1).max(2000).optional(),
    id: z.string().min(1).max(2000).optional(),
    variantId: z.string().min(1).max(2000).optional(),
    merchandiseId: z.string().min(1).max(2000).optional(),
    quantity: z.number().int().min(1)
  })
  .transform(({ cartLineId, id, variantId, merchandiseId, quantity }) => ({
    cartLineId: cartLineId ?? id ?? '',
    variantId: variantId ?? merchandiseId ?? '',
    quantity
  }))
  .pipe(
    z.object({
      cartLineId: z.string().min(1).max(2000),
      variantId: z.string().min(1).max(2000),
      quantity: z.number().int().min(1)
    })
  );

export const cartLinesBodySchema = z.object({
  lines: z.array(cartLineInputSchema).min(1).max(100)
});

export const cartLinesUpdateBodySchema = z.object({
  lines: z.array(cartLineUpdateInputSchema).min(1).max(100)
});

export const cartLinesRemoveBodySchema = z
  .object({
    cartLineIds: z.array(z.string().min(1).max(2000)).min(1).max(100).optional(),
    lineIds: z.array(z.string().min(1).max(2000)).min(1).max(100).optional()
  })
  .transform(({ cartLineIds, lineIds }) => ({
    cartLineIds: cartLineIds ?? lineIds ?? []
  }))
  .pipe(
    z.object({
      cartLineIds: z.array(z.string().min(1).max(2000)).min(1).max(100)
    })
  );

const moneySchema = {
  type: 'object',
  required: ['amount', 'currencyCode'],
  properties: {
    amount: { type: 'string' },
    currencyCode: { type: 'string' }
  }
} as const;

const imageSchema = {
  type: 'object',
  required: ['url', 'altText', 'width', 'height'],
  properties: {
    url: { type: 'string' },
    altText: { type: ['string', 'null'] },
    width: { type: ['number', 'null'] },
    height: { type: ['number', 'null'] }
  }
} as const;

const productVariantSchema = {
  type: 'object',
  required: ['variantId', 'title', 'availableForSale', 'quantityAvailable', 'price', 'selectedOptions'],
  properties: {
    variantId: { type: 'string' },
    title: { type: 'string' },
    availableForSale: { type: 'boolean' },
    quantityAvailable: { type: ['number', 'null'] },
    price: moneySchema,
    selectedOptions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: { type: 'string' },
          value: { type: 'string' }
        }
      }
    }
  }
} as const;

export const productResponseSchema = {
  type: 'object',
  required: [
    'productId',
    'title',
    'handle',
    'description',
    'availableForSale',
    'images',
    'priceRange',
    'variants'
  ],
  properties: {
    productId: { type: 'string' },
    title: { type: 'string' },
    handle: { type: 'string' },
    description: { type: 'string' },
    availableForSale: { type: 'boolean' },
    images: { type: 'array', items: imageSchema },
    priceRange: {
      type: 'object',
      required: ['minVariantPrice', 'maxVariantPrice'],
      properties: {
        minVariantPrice: moneySchema,
        maxVariantPrice: moneySchema
      }
    },
    variants: { type: 'array', items: productVariantSchema }
  }
} as const;

export const productsResponseSchema = {
  type: 'object',
  required: ['items', 'pageInfo'],
  properties: {
    items: { type: 'array', items: productResponseSchema },
    pageInfo: {
      type: 'object',
      required: ['hasNextPage', 'hasPreviousPage', 'previousPageToken', 'nextPageToken'],
      properties: {
        hasNextPage: { type: 'boolean' },
        hasPreviousPage: { type: 'boolean' },
        previousPageToken: { type: ['string', 'null'] },
        nextPageToken: { type: ['string', 'null'] }
      }
    }
  }
} as const;

export const cartResponseSchema = {
  type: 'object',
  required: ['cartId', 'checkoutUrl', 'totalQuantity', 'lines', 'cost'],
  properties: {
    cartId: { type: 'string' },
    checkoutUrl: { type: 'string' },
    totalQuantity: { type: 'number' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        required: ['cartLineId', 'quantity', 'merchandise', 'cost'],
        properties: {
          cartLineId: { type: 'string' },
          quantity: { type: 'number' },
          merchandise: {
            type: 'object',
            required: ['variantId', 'title', 'product', 'image', 'price'],
            properties: {
              variantId: { type: 'string' },
              title: { type: 'string' },
              product: {
                type: 'object',
                required: ['productId', 'title', 'handle'],
                properties: {
                  productId: { type: 'string' },
                  title: { type: 'string' },
                  handle: { type: 'string' }
                }
              },
              image: { ...imageSchema, nullable: true },
              price: moneySchema
            }
          },
          cost: {
            type: 'object',
            required: ['totalAmount'],
            properties: {
              totalAmount: moneySchema
            }
          }
        }
      }
    },
    cost: {
      type: 'object',
      required: ['subtotalAmount', 'totalAmount', 'totalTaxAmount'],
      properties: {
        subtotalAmount: moneySchema,
        totalAmount: moneySchema,
        totalTaxAmount: { ...moneySchema, nullable: true }
      }
    }
  }
} as const;

export const checkoutUrlResponseSchema = {
  type: 'object',
  required: ['checkoutUrl'],
  properties: {
    checkoutUrl: { type: 'string' }
  }
} as const;

export const cartLinesBodyJsonSchema = {
  type: 'object',
  required: ['lines'],
  properties: {
    lines: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        required: ['quantity'],
        anyOf: [{ required: ['variantId'] }, { required: ['merchandiseId'] }],
        properties: {
          variantId: { type: 'string' },
          merchandiseId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 }
        }
      }
    }
  }
} as const;

export const cartLinesUpdateBodyJsonSchema = {
  type: 'object',
  required: ['lines'],
  properties: {
    lines: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: {
        type: 'object',
        required: ['quantity'],
        anyOf: [
          { required: ['cartLineId'] },
          { required: ['id'] },
          { required: ['variantId'] },
          { required: ['merchandiseId'] }
        ],
        properties: {
          cartLineId: { type: 'string' },
          id: { type: 'string' },
          variantId: { type: 'string' },
          merchandiseId: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 }
        }
      }
    }
  }
} as const;

export const cartLinesRemoveBodyJsonSchema = {
  type: 'object',
  anyOf: [{ required: ['cartLineIds'] }, { required: ['lineIds'] }],
  properties: {
    cartLineIds: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: { type: 'string' }
    },
    lineIds: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      items: { type: 'string' }
    }
  }
} as const;
