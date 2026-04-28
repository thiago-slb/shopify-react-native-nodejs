import { BadRequestError, UpstreamError } from '../../../shared/errors/app-error.js';
import type { ShopifyRepository } from '../application/shopify-repository.js';
import type { Cart, CartLineInput, CartLineUpdateInput } from '../domain/cart.js';
import type {
  Money,
  PageInfo,
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

type ShopifyPageInfo = PageInfo;

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
    id: variant.id,
    title: variant.title,
    availableForSale: variant.availableForSale,
    quantityAvailable: variant.quantityAvailable,
    price: variant.price,
    selectedOptions: variant.selectedOptions
  };
}

function normalizeProduct(product: ShopifyProduct): Product {
  return {
    id: product.id,
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
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: nodes(cart.lines).map((line) => ({
      id: line.id,
      quantity: line.quantity,
      cost: line.cost,
      merchandise: {
        id: line.merchandise.id,
        title: line.merchandise.title,
        product: line.merchandise.product,
        image: line.merchandise.image ? normalizeImage(line.merchandise.image) : null,
        price: line.merchandise.price
      }
    }))
  };
}

function requireMutationCart(payload: MutationPayload): Cart {
  if (payload.userErrors.length > 0) {
    throw new BadRequestError('Shopify rejected the cart operation', {
      userErrors: payload.userErrors.map((error) => ({
        field: error.field,
        message: error.message,
        code: error.code
      }))
    });
  }

  if (!payload.cart) {
    throw new UpstreamError('Shopify did not return a cart for the cart operation');
  }

  return normalizeCart(payload.cart);
}

export class ShopifyStorefrontRepository implements ShopifyRepository {
  constructor(private readonly client: ShopifyStorefrontClient) {}

  async listProducts(params: ProductListParams): Promise<ProductConnection> {
    const data = await this.client.request<
      {
        products: Connection<ShopifyProduct> & {
          pageInfo: ShopifyPageInfo;
        };
      },
      { first: number; after?: string; query?: string }
    >(productsQuery, {
      first: params.first ?? 20,
      after: params.after,
      query: params.query
    });

    return {
      items: nodes(data.products).map(normalizeProduct),
      pageInfo: data.products.pageInfo
    };
  }

  async getProductByHandle(handle: string): Promise<Product | null> {
    const data = await this.client.request<
      {
        productByHandle: ShopifyProduct | null;
      },
      { handle: string }
    >(productByHandleQuery, { handle });

    return data.productByHandle ? normalizeProduct(data.productByHandle) : null;
  }

  async createCart(lines: CartLineInput[]): Promise<Cart> {
    const data = await this.client.request<
      { cartCreate: MutationPayload },
      { input: { lines: CartLineInput[] } }
    >(cartCreateMutation, { input: { lines } });

    return requireMutationCart(data.cartCreate);
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const data = await this.client.request<{ cart: ShopifyCart | null }, { cartId: string }>(
      cartQuery,
      { cartId }
    );

    return data.cart ? normalizeCart(data.cart) : null;
  }

  async addCartLines(cartId: string, lines: CartLineInput[]): Promise<Cart> {
    const data = await this.client.request<
      { cartLinesAdd: MutationPayload },
      { cartId: string; lines: CartLineInput[] }
    >(cartLinesAddMutation, { cartId, lines });

    return requireMutationCart(data.cartLinesAdd);
  }

  async updateCartLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
    const data = await this.client.request<
      { cartLinesUpdate: MutationPayload },
      { cartId: string; lines: CartLineUpdateInput[] }
    >(cartLinesUpdateMutation, { cartId, lines });

    return requireMutationCart(data.cartLinesUpdate);
  }

  async removeCartLines(cartId: string, lineIds: string[]): Promise<Cart> {
    const data = await this.client.request<
      { cartLinesRemove: MutationPayload },
      { cartId: string; lineIds: string[] }
    >(cartLinesRemoveMutation, { cartId, lineIds });

    return requireMutationCart(data.cartLinesRemove);
  }
}
