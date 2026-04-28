import type { CartLineInput } from './cart.js';
import type { Money } from './product.js';

export type DemoOrderLine = {
  id: string;
  title: string;
  variantTitle: string;
  merchandiseId: string;
  quantity: number;
  imageUrl: string | null;
  price: Money;
};

export type DemoOrder = {
  id: string;
  orderNumber: string;
  processedAt: string;
  status: 'demo' | 'open' | 'fulfilled' | 'cancelled';
  total: Money;
  lines: DemoOrderLine[];
};

export type DemoOrdersResponse = {
  items: DemoOrder[];
  limitation: string;
};

export type DemoRebuyResponse = {
  orderId: string;
  lines: CartLineInput[];
  limitation: string;
};
