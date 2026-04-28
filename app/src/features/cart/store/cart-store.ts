import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product, ProductVariant } from '@/src/features/products/types/product';
import { getErrorMessage } from '@/src/shared/api/errors';
import { addCartLines, createCart, removeCartLines, updateCartLines } from '../api/cart-api';
import type { Cart, CartLine, CartLineInput } from '../types/cart';

type SyncStatus = 'idle' | 'syncing' | 'error';

type CartState = {
  cartId: string | null;
  items: CartLine[];
  syncStatus: SyncStatus;
  lastError: string | null;
  addedPulse: number;
  itemCount: number;
  subtotalLabel: string | null;
  hydrateFromCart: (cart: Cart) => void;
  addProduct: (product: Product, variant: ProductVariant) => Promise<void>;
  addLinesForRebuy: (lines: CartLineInput[]) => Promise<void>;
  changeQuantity: (line: CartLine, nextQuantity: number) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  clearError: () => void;
};

function deriveCount(items: CartLine[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function setFromCart(cart: Cart): Pick<CartState, 'cartId' | 'items' | 'itemCount' | 'subtotalLabel'> {
  return {
    cartId: cart.id,
    items: cart.lines,
    itemCount: cart.totalQuantity,
    subtotalLabel: `${cart.cost.subtotalAmount.amount} ${cart.cost.subtotalAmount.currencyCode}`
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartId: null,
      items: [],
      syncStatus: 'idle',
      lastError: null,
      addedPulse: 0,
      itemCount: 0,
      subtotalLabel: null,
      hydrateFromCart(cart) {
        set({ ...setFromCart(cart), syncStatus: 'idle', lastError: null });
      },
      async addProduct(product, variant) {
        const optimisticLine: CartLine = {
          id: `optimistic-${variant.id}`,
          quantity: 1,
          merchandise: {
            id: variant.id,
            title: variant.title,
            product: {
              id: product.id,
              title: product.title,
              handle: product.handle
            },
            image: product.images[0] ?? null,
            price: variant.price
          },
          cost: {
            totalAmount: variant.price
          }
        };

        set((state) => ({
          items: [...state.items, optimisticLine],
          itemCount: state.itemCount + 1,
          syncStatus: 'syncing',
          lastError: null,
          addedPulse: state.addedPulse + 1
        }));

        try {
          const line = { merchandiseId: variant.id, quantity: 1 };
          const cart = get().cartId
            ? await addCartLines(get().cartId as string, [line])
            : await createCart([line]);
          set({ ...setFromCart(cart), syncStatus: 'idle', lastError: null });
        } catch (error) {
          set((state) => ({
            items: state.items.filter((item) => item.id !== optimisticLine.id),
            itemCount: Math.max(0, state.itemCount - 1),
            syncStatus: 'error',
            lastError: getErrorMessage(error)
          }));
        }
      },
      async addLinesForRebuy(lines) {
        if (lines.length === 0) {
          return;
        }

        set({ syncStatus: 'syncing', lastError: null });

        try {
          const cart = get().cartId
            ? await addCartLines(get().cartId as string, lines)
            : await createCart(lines);
          set((state) => ({
            ...setFromCart(cart),
            syncStatus: 'idle',
            lastError: null,
            addedPulse: state.addedPulse + 1
          }));
        } catch (error) {
          set({ syncStatus: 'error', lastError: getErrorMessage(error) });
        }
      },
      async changeQuantity(line, nextQuantity) {
        if (!get().cartId) {
          return;
        }

        if (nextQuantity <= 0) {
          await get().removeLine(line.id);
          return;
        }

        const previousItems = get().items;
        set((state) => ({
          items: state.items.map((item) =>
            item.id === line.id ? { ...item, quantity: nextQuantity } : item
          ),
          itemCount: deriveCount(
            state.items.map((item) => (item.id === line.id ? { ...item, quantity: nextQuantity } : item))
          ),
          syncStatus: 'syncing',
          lastError: null
        }));

        try {
          const cart = await updateCartLines(get().cartId as string, [
            {
              id: line.id,
              merchandiseId: line.merchandise.id,
              quantity: nextQuantity
            }
          ]);
          set({ ...setFromCart(cart), syncStatus: 'idle', lastError: null });
        } catch (error) {
          set({
            items: previousItems,
            itemCount: deriveCount(previousItems),
            syncStatus: 'error',
            lastError: getErrorMessage(error)
          });
        }
      },
      async removeLine(lineId) {
        if (!get().cartId) {
          return;
        }

        const previousItems = get().items;
        set((state) => {
          const nextItems = state.items.filter((item) => item.id !== lineId);
          return {
            items: nextItems,
            itemCount: deriveCount(nextItems),
            syncStatus: 'syncing',
            lastError: null
          };
        });

        try {
          const cart = await removeCartLines(get().cartId as string, [lineId]);
          set({ ...setFromCart(cart), syncStatus: 'idle', lastError: null });
        } catch (error) {
          set({
            items: previousItems,
            itemCount: deriveCount(previousItems),
            syncStatus: 'error',
            lastError: getErrorMessage(error)
          });
        }
      },
      clearError() {
        set({ lastError: null, syncStatus: 'idle' });
      }
    }),
    {
      name: 'shopify-poc-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cartId: state.cartId,
        items: state.items,
        itemCount: state.itemCount,
        subtotalLabel: state.subtotalLabel
      })
    }
  )
);
