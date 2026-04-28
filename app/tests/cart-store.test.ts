import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from '@/src/features/cart/store/cart-store';
import type { Product, ProductVariant } from '@/src/features/products/types/product';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}));

vi.mock('@/src/features/cart/api/cart-api', () => ({
  createCart: vi.fn().mockResolvedValue({
    id: 'cart-1',
    checkoutUrl: 'https://checkout.example',
    totalQuantity: 1,
    lines: [
      {
        id: 'line-1',
        quantity: 1,
        merchandise: {
          id: 'variant-1',
          title: 'Default',
          product: { id: 'product-1', title: 'Demo Product', handle: 'demo-product' },
          image: null,
          price: { amount: '10.00', currencyCode: 'USD' }
        },
        cost: { totalAmount: { amount: '10.00', currencyCode: 'USD' } }
      }
    ],
    cost: {
      subtotalAmount: { amount: '10.00', currencyCode: 'USD' },
      totalAmount: { amount: '10.00', currencyCode: 'USD' },
      totalTaxAmount: null
    }
  }),
  addCartLines: vi.fn(),
  updateCartLines: vi.fn(),
  removeCartLines: vi.fn()
}));

const product: Product = {
  id: 'product-1',
  title: 'Demo Product',
  handle: 'demo-product',
  description: '',
  availableForSale: true,
  images: [],
  priceRange: {
    minVariantPrice: { amount: '10.00', currencyCode: 'USD' },
    maxVariantPrice: { amount: '10.00', currencyCode: 'USD' }
  },
  variants: []
};

const variant: ProductVariant = {
  id: 'variant-1',
  title: 'Default',
  availableForSale: true,
  quantityAvailable: 4,
  price: { amount: '10.00', currencyCode: 'USD' },
  selectedOptions: []
};

describe('cart store', () => {
  beforeEach(() => {
    useCartStore.setState({
      cartId: null,
      items: [],
      itemCount: 0,
      syncStatus: 'idle',
      lastError: null,
      addedPulse: 0,
      subtotalLabel: null
    });
  });

  it('optimistically adds and reconciles a Shopify cart line', async () => {
    await useCartStore.getState().addProduct(product, variant);

    expect(useCartStore.getState()).toMatchObject({
      cartId: 'cart-1',
      itemCount: 1,
      syncStatus: 'idle'
    });
    expect(useCartStore.getState().items[0]?.id).toBe('line-1');
  });
});
