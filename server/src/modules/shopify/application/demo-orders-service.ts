import { NotFoundError } from '../../../shared/errors/app-error.js';
import type { DemoOrder, DemoOrdersResponse, DemoRebuyResponse } from '../domain/order.js';
import { encodePublicId } from './public-id.js';

const limitation =
  'Shopify Storefront API cannot fetch anonymous customer order history. This POC returns backend demo orders; production order history needs customer auth, Admin API mediation, or webhooks.';

const demoOrders: DemoOrder[] = [
  {
    id: 'demo-order-1001',
    orderNumber: '#1001',
    processedAt: '2026-04-12T15:24:00.000Z',
    status: 'demo',
    total: { amount: '78.00', currencyCode: 'USD' },
    lines: [
      {
        id: 'demo-line-1',
        title: 'Demo Everyday Tee',
        variantTitle: 'Black / M',
        merchandiseId: 'gid://shopify/ProductVariant/demo-everyday-tee-black-m',
        quantity: 2,
        imageUrl: null,
        price: { amount: '29.00', currencyCode: 'USD' }
      },
      {
        id: 'demo-line-2',
        title: 'Demo Canvas Tote',
        variantTitle: 'Natural',
        merchandiseId: 'gid://shopify/ProductVariant/demo-canvas-tote-natural',
        quantity: 1,
        imageUrl: null,
        price: { amount: '20.00', currencyCode: 'USD' }
      }
    ]
  },
  {
    id: 'demo-order-1000',
    orderNumber: '#1000',
    processedAt: '2026-03-29T18:08:00.000Z',
    status: 'demo',
    total: { amount: '44.00', currencyCode: 'USD' },
    lines: [
      {
        id: 'demo-line-3',
        title: 'Demo Ribbed Socks',
        variantTitle: 'Olive / L',
        merchandiseId: 'gid://shopify/ProductVariant/demo-ribbed-socks-olive-l',
        quantity: 2,
        imageUrl: null,
        price: { amount: '22.00', currencyCode: 'USD' }
      }
    ]
  }
];

export class DemoOrdersService {
  listOrders(): DemoOrdersResponse {
    return {
      items: demoOrders,
      limitation
    };
  }

  getOrder(orderId: string): DemoOrder {
    const order = demoOrders.find((item) => item.id === orderId);

    if (!order) {
      throw new NotFoundError('Order not found', { orderId });
    }

    return order;
  }

  rebuyOrder(orderId: string): DemoRebuyResponse {
    const order = this.getOrder(orderId);

    return {
      orderId,
      lines: order.lines.map((line) => ({
        variantId: encodePublicId('variant', line.merchandiseId),
        quantity: line.quantity
      })),
      limitation
    };
  }
}
