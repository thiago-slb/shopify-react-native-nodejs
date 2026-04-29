import type { AppConfig } from '../../../config/env.js';
import {
  BadRequestError,
  UpstreamError,
  UpstreamUnavailableError
} from '../../../shared/errors/app-error.js';
import type { ShopifyRepository } from '../application/shopify-repository.js';
import { decodePageToken, encodePageToken } from '../application/pagination-token.js';
import { decodePublicId, encodePublicId } from '../application/public-id.js';
import type { Cart, CartLineInput, CartLineUpdateInput } from '../domain/cart.js';
import type {
  Money,
  Product,
  ProductConnection,
  ProductImage,
  ProductListParams,
  ProductVariant
} from '../domain/product.js';
import type { ShopifyAdminClient } from './shopify-admin-client.js';
import {
  cartCreateMutation,
  cartLinesAddMutation,
  cartLinesRemoveMutation,
  cartLinesUpdateMutation,
  cartQuery,
  productByHandleQuery,
  productsQuery
} from './shopify-admin-queries.js';

type Edge<TNode> = {
  node: TNode;
};

type Connection<TNode> = {
  edges: Array<Edge<TNode>>;
};

type ShopifyMoney = Money;

type ShopifyImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  priceAmount?: string;
  price: ShopifyMoney;
  selectedOptions: Array<{ name: string; value: string }>;
  image: ShopifyImage | null;
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  images: Connection<ShopifyImage>;
  priceRange: {
    minVariantPrice: ShopifyMoney;
    maxVariantPrice: ShopifyMoney;
  };
  variants: Connection<ShopifyVariant>;
};

type ShopifyPageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

type ShopifyShop = {
  currencyCode: string;
};

type ShopifyCartLine = {
  id: string;
  quantity: number;
  cost: {
    totalAmount: ShopifyMoney;
  };
  merchandise: ShopifyVariant & {
    product: {
      id: string;
      title: string;
      handle: string;
    };
  };
};

type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: Connection<ShopifyCartLine>;
  cost: {
    subtotalAmount: ShopifyMoney;
    totalAmount: ShopifyMoney;
    totalTaxAmount: ShopifyMoney | null;
  };
};

type ShopifyUserError = {
  field: string[] | null;
  message: string;
  code?: string;
};

type MutationPayload = {
  cart: ShopifyCart | null;
  userErrors: ShopifyUserError[];
};

type CatalogCacheEntry<TValue> = {
  value: TValue;
  freshUntil: number;
  staleUntil: number;
};

type RepositoryConfig = Pick<
  AppConfig,
  | 'PRODUCT_CACHE_TTL_MS'
  | 'PRODUCT_CACHE_STALE_MS'
  | 'PRODUCT_LIST_IMAGE_LIMIT'
  | 'PRODUCT_LIST_VARIANT_LIMIT'
  | 'PRODUCT_DETAIL_IMAGE_LIMIT'
  | 'PRODUCT_DETAIL_VARIANT_LIMIT'
>;

const defaultRepositoryConfig: RepositoryConfig = {
  PRODUCT_CACHE_TTL_MS: 30_000,
  PRODUCT_CACHE_STALE_MS: 300_000,
  PRODUCT_LIST_IMAGE_LIMIT: 1,
  PRODUCT_LIST_VARIANT_LIMIT: 20,
  PRODUCT_DETAIL_IMAGE_LIMIT: 10,
  PRODUCT_DETAIL_VARIANT_LIMIT: 100
};

function nodes<TNode>(connection: Connection<TNode>): TNode[] {
  return connection.edges.map((edge) => edge.node);
}

function normalizeImage(image: ShopifyImage): ProductImage {
  return {
    url: image.url,
    altText: image.altText,
    width: image.width,
    height: image.height
  };
}

function normalizeVariant(variant: ShopifyVariant, currencyCode: string): ProductVariant {
  return {
    variantId: encodePublicId('variant', variant.id),
    title: variant.title,
    availableForSale: variant.availableForSale,
    quantityAvailable: variant.quantityAvailable,
    price: variant.priceAmount
      ? { amount: variant.priceAmount, currencyCode }
      : variant.price,
    selectedOptions: variant.selectedOptions
  };
}

function normalizeProduct(product: ShopifyProduct, currencyCode: string): Product {
  return {
    productId: encodePublicId('product', product.id),
    title: product.title,
    handle: product.handle,
    description: product.description,
    availableForSale: nodes(product.variants).some((variant) => variant.availableForSale),
    images: nodes(product.images).map(normalizeImage),
    priceRange: product.priceRange,
    variants: nodes(product.variants).map((variant) => normalizeVariant(variant, currencyCode))
  };
}

function normalizeCart(cart: ShopifyCart): Cart {
  return {
    cartId: encodePublicId('cart', cart.id),
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: nodes(cart.lines).map((line) => ({
      cartLineId: encodePublicId('cartLine', line.id),
      quantity: line.quantity,
      cost: line.cost,
      merchandise: {
        variantId: encodePublicId('variant', line.merchandise.id),
        title: line.merchandise.title,
        product: {
          productId: encodePublicId('product', line.merchandise.product.id),
          title: line.merchandise.product.title,
          handle: line.merchandise.product.handle
        },
        image: line.merchandise.image ? normalizeImage(line.merchandise.image) : null,
        price: line.merchandise.price
      }
    }))
  };
}

function requireMutationCart(payload: MutationPayload): Cart {
  if (payload.userErrors.length > 0) {
    const errors = payload.userErrors.map(normalizeUserError);
    throw new BadRequestError(
      errors[0]?.message ?? 'Cart operation rejected',
      { errors },
      errors[0]?.code,
      { shopifyUserErrors: payload.userErrors }
    );
  }

  if (!payload.cart) {
    throw new UpstreamError('Shopify did not return a cart for the cart operation');
  }

  return normalizeCart(payload.cart);
}

function normalizeUserError(error: ShopifyUserError): { code: string; message: string } {
  const field = error.field?.join('.') ?? '';
  const message = error.message.toLowerCase();

  if (field.includes('quantity') || message.includes('quantity') || message.includes('available')) {
    return {
      code: 'QUANTITY_UNAVAILABLE',
      message: 'Requested quantity is not available.'
    };
  }

  if (field.includes('merchandise') || message.includes('variant')) {
    return {
      code: 'INVALID_VARIANT',
      message: 'Selected variant is not available.'
    };
  }

  if (message.includes('cart') && (message.includes('expired') || message.includes('invalid'))) {
    return {
      code: 'CART_EXPIRED',
      message: 'Cart is no longer available.'
    };
  }

  if (field.includes('lines') || message.includes('line')) {
    return {
      code: 'CART_LINE_UNAVAILABLE',
      message: 'Cart line is no longer available.'
    };
  }

  return {
    code: 'CART_OPERATION_REJECTED',
    message: 'Cart operation could not be completed.'
  };
}

function toShopifyLineInput(line: CartLineInput): { merchandiseId: string; quantity: number } {
  return {
    merchandiseId: decodePublicId('variant', line.variantId),
    quantity: line.quantity
  };
}

function toShopifyLineUpdateInput(line: CartLineUpdateInput): {
  id: string;
  merchandiseId: string;
  quantity: number;
} {
  return {
    id: decodePublicId('cartLine', line.cartLineId),
    merchandiseId: decodePublicId('variant', line.variantId),
    quantity: line.quantity
  };
}

export class ShopifyAdminRepository implements ShopifyRepository {
  private readonly config: RepositoryConfig;
  private readonly productListCache = new Map<string, CatalogCacheEntry<ProductConnection>>();
  private readonly productDetailCache = new Map<string, CatalogCacheEntry<Product | null>>();
  private cacheHits = 0;
  private staleCacheHits = 0;
  private cacheMisses = 0;
  private lastListResponseBytes = 0;
  private lastDetailResponseBytes = 0;

  constructor(
    private readonly client: ShopifyAdminClient,
    config: Partial<RepositoryConfig> = {}
  ) {
    this.config = { ...defaultRepositoryConfig, ...config };
  }

  async listProducts(params: ProductListParams): Promise<ProductConnection> {
    const cacheKey = JSON.stringify({
      first: params.first ?? 20,
      pageToken: params.pageToken ?? null,
      query: params.query ?? null,
      imageLimit: this.config.PRODUCT_LIST_IMAGE_LIMIT,
      variantLimit: this.config.PRODUCT_LIST_VARIANT_LIMIT
    });
    const cached = this.getFreshCache(this.productListCache, cacheKey);
    if (cached) {
      return cached;
    }

    const pageToken = decodePageToken(params.pageToken);
    const pageSize = params.first ?? 20;
    try {
      const data = await this.client.request<
        {
          shop: ShopifyShop;
          products: Connection<ShopifyProduct> & {
            pageInfo: ShopifyPageInfo;
          };
        },
        {
          first?: number;
          last?: number;
          after?: string;
          before?: string;
          query?: string;
          imageLimit: number;
          variantLimit: number;
        }
      >(productsQuery, {
        first: pageToken?.direction === 'previous' ? undefined : pageSize,
        last: pageToken?.direction === 'previous' ? pageSize : undefined,
        after: pageToken?.direction === 'next' ? pageToken.cursor : undefined,
        before: pageToken?.direction === 'previous' ? pageToken.cursor : undefined,
        query: params.query,
        imageLimit: this.config.PRODUCT_LIST_IMAGE_LIMIT,
        variantLimit: this.config.PRODUCT_LIST_VARIANT_LIMIT
      }, { retriable: true });

      const result = {
        items: nodes(data.products).map((product) => normalizeProduct(product, data.shop.currencyCode)),
        pageInfo: {
          hasNextPage: data.products.pageInfo.hasNextPage,
          hasPreviousPage: data.products.pageInfo.hasPreviousPage,
          previousPageToken: encodePageToken(data.products.pageInfo.startCursor, 'previous'),
          nextPageToken: encodePageToken(data.products.pageInfo.endCursor, 'next')
        }
      };
      this.lastListResponseBytes = responseBytes(result);
      this.setCache(this.productListCache, cacheKey, result);
      return result;
    } catch (error) {
      const stale = this.getStaleCache(this.productListCache, cacheKey, error);
      if (stale) {
        return stale;
      }

      throw error;
    }
  }

  async getProductByHandle(handle: string): Promise<Product | null> {
    const cacheKey = JSON.stringify({
      handle,
      imageLimit: this.config.PRODUCT_DETAIL_IMAGE_LIMIT,
      variantLimit: this.config.PRODUCT_DETAIL_VARIANT_LIMIT
    });
    const cached = this.getFreshCache(this.productDetailCache, cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const data = await this.client.request<
        {
          shop: ShopifyShop;
          productByHandle: ShopifyProduct | null;
        },
        { handle: string; imageLimit: number; variantLimit: number }
      >(productByHandleQuery, {
        handle,
        imageLimit: this.config.PRODUCT_DETAIL_IMAGE_LIMIT,
        variantLimit: this.config.PRODUCT_DETAIL_VARIANT_LIMIT
      }, { retriable: true });

      const result = data.productByHandle
        ? normalizeProduct(data.productByHandle, data.shop.currencyCode)
        : null;
      this.lastDetailResponseBytes = responseBytes(result);
      this.setCache(this.productDetailCache, cacheKey, result);
      return result;
    } catch (error) {
      const stale = this.getStaleCache(this.productDetailCache, cacheKey, error);
      if (stale !== undefined) {
        return stale;
      }

      throw error;
    }
  }

  async createCart(lines: CartLineInput[]): Promise<Cart> {
    const data = await this.client.request<
      { cartCreate: MutationPayload },
      { input: { lines: Array<{ merchandiseId: string; quantity: number }> } }
    >(cartCreateMutation, { input: { lines: lines.map(toShopifyLineInput) } });

    return requireMutationCart(data.cartCreate);
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const data = await this.client.request<{ cart: ShopifyCart | null }, { cartId: string }>(
      cartQuery,
      { cartId: decodePublicId('cart', cartId) },
      { retriable: true }
    );

    return data.cart ? normalizeCart(data.cart) : null;
  }

  async addCartLines(cartId: string, lines: CartLineInput[]): Promise<Cart> {
    const data = await this.client.request<
      { cartLinesAdd: MutationPayload },
      { cartId: string; lines: Array<{ merchandiseId: string; quantity: number }> }
    >(cartLinesAddMutation, { cartId: decodePublicId('cart', cartId), lines: lines.map(toShopifyLineInput) });

    return requireMutationCart(data.cartLinesAdd);
  }

  async updateCartLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
    const data = await this.client.request<
      { cartLinesUpdate: MutationPayload },
      { cartId: string; lines: Array<{ id: string; merchandiseId: string; quantity: number }> }
    >(cartLinesUpdateMutation, {
      cartId: decodePublicId('cart', cartId),
      lines: lines.map(toShopifyLineUpdateInput)
    });

    return requireMutationCart(data.cartLinesUpdate);
  }

  async removeCartLines(cartId: string, lineIds: string[]): Promise<Cart> {
    const data = await this.client.request<
      { cartLinesRemove: MutationPayload },
      { cartId: string; lineIds: string[] }
    >(cartLinesRemoveMutation, {
      cartId: decodePublicId('cart', cartId),
      lineIds: lineIds.map((lineId) => decodePublicId('cartLine', lineId))
    });

    return requireMutationCart(data.cartLinesRemove);
  }

  getCatalogCacheMetrics(): {
    hits: number;
    staleHits: number;
    misses: number;
    lastListResponseBytes: number;
    lastDetailResponseBytes: number;
  } {
    return {
      hits: this.cacheHits,
      staleHits: this.staleCacheHits,
      misses: this.cacheMisses,
      lastListResponseBytes: this.lastListResponseBytes,
      lastDetailResponseBytes: this.lastDetailResponseBytes
    };
  }

  private getFreshCache<TValue>(
    cache: Map<string, CatalogCacheEntry<TValue>>,
    key: string
  ): TValue | undefined {
    const entry = cache.get(key);
    if (!entry) {
      this.cacheMisses += 1;
      return undefined;
    }

    if (Date.now() <= entry.freshUntil) {
      this.cacheHits += 1;
      return entry.value;
    }

    return undefined;
  }

  private getStaleCache<TValue>(
    cache: Map<string, CatalogCacheEntry<TValue>>,
    key: string,
    error: unknown
  ): TValue | undefined {
    if (!(error instanceof UpstreamUnavailableError)) {
      return undefined;
    }

    const entry = cache.get(key);
    if (!entry || Date.now() > entry.staleUntil) {
      return undefined;
    }

    this.staleCacheHits += 1;
    return entry.value;
  }

  private setCache<TValue>(
    cache: Map<string, CatalogCacheEntry<TValue>>,
    key: string,
    value: TValue
  ): void {
    const now = Date.now();
    cache.set(key, {
      value,
      freshUntil: now + this.config.PRODUCT_CACHE_TTL_MS,
      staleUntil: now + this.config.PRODUCT_CACHE_STALE_MS
    });
  }
}

function responseBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}
