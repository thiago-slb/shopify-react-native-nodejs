import { BadRequestError, UpstreamError } from '../../../shared/errors/app-error.js';
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
import type { ShopifyStorefrontClient } from './storefront-client.js';
import {
  cartCreateMutation,
  cartLinesAddMutation,
  cartLinesRemoveMutation,
  cartLinesUpdateMutation,
  cartQuery,
  productByHandleQuery,
  productsQuery
} from './storefront-queries.js';

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
  price: ShopifyMoney;
  selectedOptions: Array<{ name: string; value: string }>;
  image: ShopifyImage | null;
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
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

function normalizeVariant(variant: ShopifyVariant): ProductVariant {
  return {
    variantId: encodePublicId('variant', variant.id),
    title: variant.title,
    availableForSale: variant.availableForSale,
    quantityAvailable: variant.quantityAvailable,
    price: variant.price,
    selectedOptions: variant.selectedOptions
  };
}

function normalizeProduct(product: ShopifyProduct): Product {
  return {
    productId: encodePublicId('product', product.id),
    title: product.title,
    handle: product.handle,
    description: product.description,
    availableForSale: product.availableForSale,
    images: nodes(product.images).map(normalizeImage),
    priceRange: product.priceRange,
    variants: nodes(product.variants).map(normalizeVariant)
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

export class ShopifyStorefrontRepository implements ShopifyRepository {
  constructor(private readonly client: ShopifyStorefrontClient) {}

  async listProducts(params: ProductListParams): Promise<ProductConnection> {
    const pageToken = decodePageToken(params.pageToken);
    const pageSize = params.first ?? 20;
    const data = await this.client.request<
      {
        products: Connection<ShopifyProduct> & {
          pageInfo: ShopifyPageInfo;
        };
      },
      { first?: number; last?: number; after?: string; before?: string; query?: string }
    >(productsQuery, {
      first: pageToken?.direction === 'previous' ? undefined : pageSize,
      last: pageToken?.direction === 'previous' ? pageSize : undefined,
      after: pageToken?.direction === 'next' ? pageToken.cursor : undefined,
      before: pageToken?.direction === 'previous' ? pageToken.cursor : undefined,
      query: params.query
    }, { retriable: true });

    return {
      items: nodes(data.products).map(normalizeProduct),
      pageInfo: {
        hasNextPage: data.products.pageInfo.hasNextPage,
        hasPreviousPage: data.products.pageInfo.hasPreviousPage,
        previousPageToken: encodePageToken(data.products.pageInfo.startCursor, 'previous'),
        nextPageToken: encodePageToken(data.products.pageInfo.endCursor, 'next')
      }
    };
  }

  async getProductByHandle(handle: string): Promise<Product | null> {
    const data = await this.client.request<
      {
        productByHandle: ShopifyProduct | null;
      },
      { handle: string }
    >(productByHandleQuery, { handle }, { retriable: true });

    return data.productByHandle ? normalizeProduct(data.productByHandle) : null;
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
}
