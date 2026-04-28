import type { Money, ProductImage } from './product.js';

export type CartLineInput = {
  merchandiseId: string;
  quantity: number;
};

export type CartLineUpdateInput = CartLineInput & {
  id: string;
};

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      id: string;
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
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: CartLine[];
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
};
