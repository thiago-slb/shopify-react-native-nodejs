import type { AppConfig } from '../src/config/env.js';
import { encodePublicId } from '../src/modules/shopify/application/public-id.js';
import type { Cart } from '../src/modules/shopify/domain/cart.js';
import type { Product } from '../src/modules/shopify/domain/product.js';

export const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  CORS_ORIGIN: '*',
  API_DOCS_ENABLED: true,
  BODY_LIMIT_BYTES: 1_048_576,
  SHOPIFY_STOREFRONT_TIMEOUT_MS: 5000,
  SHOPIFY_STOREFRONT_READ_RETRIES: 2,
  SHOPIFY_CIRCUIT_FAILURE_THRESHOLD: 5,
  SHOPIFY_CIRCUIT_OPEN_MS: 30_000,
  PRODUCT_CACHE_TTL_MS: 30_000,
  PRODUCT_CACHE_STALE_MS: 300_000,
  PRODUCT_LIST_IMAGE_LIMIT: 1,
  PRODUCT_LIST_VARIANT_LIMIT: 20,
  PRODUCT_DETAIL_IMAGE_LIMIT: 10,
  PRODUCT_DETAIL_VARIANT_LIMIT: 100,
  SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'test-token',
  SHOPIFY_STOREFRONT_API_VERSION: '2025-01'
};

export const productFixture: Product = {
  productId: encodePublicId('product', 'gid://shopify/Product/1'),
  title: 'Test T-Shirt',
  handle: 'test-t-shirt',
  description: 'A test product',
  availableForSale: true,
  images: [
    {
      url: 'https://cdn.shopify.com/test-shirt.jpg',
      altText: 'Test shirt',
      width: 800,
      height: 800
    }
  ],
  priceRange: {
    minVariantPrice: { amount: '19.99', currencyCode: 'USD' },
    maxVariantPrice: { amount: '29.99', currencyCode: 'USD' }
  },
  variants: [
    {
      variantId: encodePublicId('variant', 'gid://shopify/ProductVariant/1'),
      title: 'Small',
      availableForSale: true,
      quantityAvailable: 10,
      price: { amount: '19.99', currencyCode: 'USD' },
      selectedOptions: [{ name: 'Size', value: 'S' }]
    }
  ]
};

export const cartFixture: Cart = {
  cartId: encodePublicId('cart', 'gid://shopify/Cart/1'),
  checkoutUrl: 'https://example.myshopify.com/cart/c/checkout',
  totalQuantity: 1,
  lines: [
    {
      cartLineId: encodePublicId('cartLine', 'gid://shopify/CartLine/1'),
      quantity: 1,
      merchandise: {
        variantId: encodePublicId('variant', 'gid://shopify/ProductVariant/1'),
        title: 'Small',
        product: {
          productId: encodePublicId('product', 'gid://shopify/Product/1'),
          title: 'Test T-Shirt',
          handle: 'test-t-shirt'
        },
        image: null,
        price: { amount: '19.99', currencyCode: 'USD' }
      },
      cost: {
        totalAmount: { amount: '19.99', currencyCode: 'USD' }
      }
    }
  ],
  cost: {
    subtotalAmount: { amount: '19.99', currencyCode: 'USD' },
    totalAmount: { amount: '19.99', currencyCode: 'USD' },
    totalTaxAmount: null
  }
};
