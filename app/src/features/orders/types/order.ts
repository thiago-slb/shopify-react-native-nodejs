import type { Money } from '@/src/shared/utils/money';
import type { CartLineInput } from '@/src/features/cart/types/cart';

export type OrderLine = {
  id: string;
  title: string;
  variantTitle: string;
  merchandiseId: string;
  quantity: number;
  imageUrl: string | null;
  price: Money;
};

export type Order = {
  id: string;
  orderNumber: string;
  processedAt: string;
  status: 'demo' | 'open' | 'fulfilled' | 'cancelled';
  total: Money;
  lines: OrderLine[];
};

export type OrdersResponse = {
  items: Order[];
  limitation: string;
};

export type RebuyResponse = {
  orderId: string;
  lines: CartLineInput[];
  limitation: string;
};
