# Shopify React Native POC

## Frontend

This Expo app is a focused mobile shopping POC for the `/server` Shopify backend. It never calls
Shopify directly and never stores Shopify secrets. All catalog, cart, checkout, and demo order calls
go through `EXPO_PUBLIC_API_BASE_URL`.

### Install

```bash
cd app
npm install
```

### Run Expo

```bash
npm run start
```

Useful checks:

```bash
npm run typecheck
npm run test
npm run lint
```

### Environment

Create `app/.env` from `app/.env.example`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

Use your computer LAN IP for physical device testing because `localhost` on a phone points to the
phone, not your laptop. The backend should be running with `host: 0.0.0.0`, which the server already
does.

### Backend API Contract

The app talks to the backend's public API contract, not Shopify's raw Storefront model. Product and
cart responses use backend-owned IDs:

- `productId`
- `variantId`
- `cartId`
- `cartLineId`

Cart requests should send `variantId`, `cartLineId`, and `cartLineIds`. The backend accepts legacy
`merchandiseId`, `id`, and `lineIds` during migration, but new app code should prefer the backend
names above.

Cart endpoints also require an `x-session-id` header. Use a stable locally persisted app/device
session identifier so the backend can bind carts to the same mobile session that created them. If the
session changes, existing cart reads, mutations, and checkout URL requests will be rejected.

Product pagination uses `pageInfo.nextPageToken` and `pageInfo.previousPageToken`. The app should
send those values back as `pageToken` instead of storing or interpreting Shopify cursors.

### Product Browsing Flow

1. Home calls `GET /api/products?query=&first=20`.
2. Search input is debounced before React Query refetches.
3. Products render in a performant `FlatList` grid keyed by backend `productId` values.
4. Loading skeletons, pull-to-refresh, empty state, and error retry are handled in the screen.
5. Product cards pass backend `variantId` values into cart calls.

### Cart Sync Flow

1. Add to cart updates Zustand optimistically.
2. The app creates or updates the Shopify cart through `/api/cart` endpoints.
3. Backend cart responses reconcile local state with `cartLineId`, quantities, totals, and images.
4. Quantity updates and removals stay optimistic where safe and roll back on sync failure.
5. `cartId`, cart lines, and the local session identity are persisted locally with AsyncStorage.

### Checkout Sheet Flow

1. Cart checkout calls `POST /api/cart/:cartId/checkout`.
2. The returned Shopify checkout URL is passed to `@shopify/checkout-sheet-kit`.
3. The native checkout sheet is preloaded and presented in-app.
4. The app listens for Checkout Sheet lifecycle events such as `completed`, `close`, and `error`.
5. Production completion should still be reconciled through customer auth or backend webhooks.

### Orders / Purchase Again Flow

The Orders tab calls:

- `GET /api/orders`
- `GET /api/orders/:orderId`
- `POST /api/orders/:orderId/rebuy`

Current backend order history is a documented demo fallback. Shopify Storefront API cannot fetch all
anonymous customer orders. Production order history should use customer-token-based Storefront
queries where auth exists, or a backend-owned order projection populated by webhooks/Admin API.

Purchase again requests backend rebuy lines, adds them to the current Shopify cart through the cart
store, then opens the cart modal. Demo variant IDs will only sync successfully if mapped to real store
variants.

### Folder Structure

```text
/app
  /app
    /(tabs)
      _layout.tsx
      index.tsx
      orders.tsx
    /cart
      index.tsx
      checkout.tsx
      order-complete.tsx
  /src
    /shared
      /api
      /components
      /config
      /hooks
      /theme
      /utils
    /features
      /products
      /cart
      /orders
  /tests
```

### Key Architecture Decisions

- Expo Router owns navigation and keeps only Home and Orders as tabs.
- TanStack React Query owns server state for products and orders.
- Zustand owns client cart state, optimistic UI, and local cart persistence.
- API DTOs are typed per feature and normalized errors use a shared `ApiError`.
- Screens compose hooks and components; business logic lives in feature APIs/stores.
