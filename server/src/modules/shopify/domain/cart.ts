import type { Money, ProductImage } from './product.js';

export type CartLineInput = {
  variantId: string;
  quantity: number;
};

export type CartLineUpdateInput = CartLineInput & {
  cartLineId: string;
};

export type CartLine = {
  cartLineId: string;
  quantity: number;
  merchandise: {
    variantId: string;
    title: string;
    product: {
      productId: string;
      title: string;
      handle: string;
    };
    image: ProductImage | null;
    price: Money;
  };
  cost: {
    totalAmount: Money;
  };
};

export type Cart = {
  cartId: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: CartLine[];
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
};
