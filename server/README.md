# Shopify React Native Backend

## Backend

This repository is intended to contain a React Native app in `/app` and the backend in
`/server`. This starter implements only the backend.

The backend is a Fastify, Node.js, and TypeScript service that talks to the Shopify
Storefront API. The mobile app should call this backend instead of calling Shopify directly.
Storefront access tokens stay on the server and are never returned by API responses.

### Project Structure

```text
/server
  /src
    /config                         Environment loading and validation
    /modules/shopify
      /application                  Use-cases and repository contracts
      /domain                       App-facing DTOs
      /infra                        Shopify Storefront GraphQL client/repository
      /presentation                 Fastify routes and request/response schemas
    /shared
      /errors                       Application error types
      /http                         HTTP error handling and validation helpers
      /logger                       Structured logger configuration
      /schemas                      Shared OpenAPI schemas
    app.ts                          Fastify app composition
    server.ts                       Process entrypoint
  /tests                            Vitest tests with mocked Shopify behavior
```

### Install

```bash
cd server
npm install
```

### Environment

Create `server/.env` from `server/.env.example`.

Required variables:

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=*
API_DOCS_ENABLED=true
BODY_LIMIT_BYTES=1048576
RATE_LIMIT_REDIS_URL=

SHOPIFY_STORE_DOMAIN=your-shop.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_storefront_access_token
SHOPIFY_STOREFRONT_API_VERSION=2025-01
SHOPIFY_STOREFRONT_TIMEOUT_MS=5000
SHOPIFY_STOREFRONT_READ_RETRIES=2
```

`SHOPIFY_STORE_DOMAIN` should be the store domain without `https://`. The token must be a
Storefront API access token, not an Admin API token.

Production startup rejects `CORS_ORIGIN=*`. Use a comma-separated allowlist such as
`https://shop.example,https://admin.example`. Swagger UI is disabled by default in production; set
`API_DOCS_ENABLED=true` only when docs are intentionally exposed or protected upstream.

Rate limiting uses route-specific budgets for catalog reads, cart mutations, and checkout URL
creation. Local development and single-instance deployments use the plugin's in-memory store. Set
`RATE_LIMIT_REDIS_URL` in multi-instance production so limits are shared across instances. Limited
requests return a stable `RATE_LIMITED` error envelope and `Retry-After` headers, and are logged with
the `rate_limit.limited_request` metric key.

Shopify Storefront requests are aborted after `SHOPIFY_STOREFRONT_TIMEOUT_MS`. Product and cart read
queries are retried with bounded exponential backoff up to `SHOPIFY_STOREFRONT_READ_RETRIES`; cart
mutations are not retried automatically.

### Run Locally

```bash
npm run dev
```

Production-style flow:

```bash
npm run build
npm start
```

Useful checks:

```bash
npm run test
npm run lint
npm run typecheck
npm run format
```

### API Documentation

When enabled, Swagger UI is available at:

```text
http://localhost:3000/docs
```

Health check:

```text
GET http://localhost:3000/health
```

### How Shopify Integration Works

The backend uses Shopify Storefront API GraphQL operations through a dedicated client wrapper
in `src/modules/shopify/infra`. Route handlers never construct GraphQL queries directly.

Implemented Storefront operations:

- `products`
- `productByHandle`
- `cartCreate`
- `cart`
- `cartLinesAdd`
- `cartLinesUpdate`
- `cartLinesRemove`

Shopify GraphQL edges and nodes are normalized into app-friendly DTOs. Public responses expose
backend-owned IDs such as `productId`, `variantId`, `cartId`, and `cartLineId`; raw
`gid://shopify/...` values stay behind the backend boundary. Product lists expose opaque
`pageInfo.nextPageToken` and `pageInfo.previousPageToken` values rather than Storefront cursors.
Pagination tokens are versioned backend tokens; they do not have a fixed server-side expiry today,
but clients should treat them as short-lived and compatible only with the current catalog query.
For compatibility during migration, the backend still accepts legacy Shopify GIDs and legacy
request fields such as `merchandiseId`, `id`, and `lineIds`, but new clients should use
`variantId`, `cartLineId`, and `cartLineIds`.

Cart endpoints require an `x-session-id` header. Carts are bound to the session that created them,
and reads, mutations, and checkout URL requests from another session are rejected. This is a
lightweight mobile session strategy for the current backend; production deployments should replace
or back it with durable user/device identity storage.

Shopify `userErrors` are mapped to backend-owned error codes such as `QUANTITY_UNAVAILABLE`,
`INVALID_VARIANT`, `CART_EXPIRED`, and `CART_LINE_UNAVAILABLE`. Raw Shopify error metadata is
logged internally with the Fastify request ID and is not returned to clients.

### Example API Calls

Fetch products:

```bash
curl "http://localhost:3000/api/products?first=10"
```

Fetch product details:

```bash
curl "http://localhost:3000/api/products/example-product-handle"
```

Create a cart:

```bash
curl -X POST "http://localhost:3000/api/cart" \
  -H "x-session-id: local-device-session" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      {
        "variantId": "var_Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0VmFyaWFudC8xMjM",
        "quantity": 1
      }
    ]
  }'
```

Fetch a cart:

```bash
curl "http://localhost:3000/api/cart/cart_Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMw" \
  -H "x-session-id: local-device-session"
```

Add cart lines:

```bash
curl -X POST "http://localhost:3000/api/cart/cart_Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMw/lines" \
  -H "x-session-id: local-device-session" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      {
        "variantId": "var_Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0VmFyaWFudC80NTY",
        "quantity": 1
      }
    ]
  }'
```

Update cart lines:

```bash
curl -X PATCH "http://localhost:3000/api/cart/cart_Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMw/lines" \
  -H "x-session-id: local-device-session" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      {
        "cartLineId": "cline_Z2lkOi8vc2hvcGlmeS9DYXJ0TGluZS83ODk",
        "variantId": "var_Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0VmFyaWFudC80NTY",
        "quantity": 2
      }
    ]
  }'
```

Remove cart lines:

```bash
curl -X DELETE "http://localhost:3000/api/cart/cart_Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMw/lines" \
  -H "x-session-id: local-device-session" \
  -H "Content-Type: application/json" \
  -d '{
    "cartLineIds": ["cline_Z2lkOi8vc2hvcGlmeS9DYXJ0TGluZS83ODk"]
  }'
```

Get checkout URL:

```bash
curl -X POST "http://localhost:3000/api/cart/cart_Z2lkOi8vc2hvcGlmeS9DYXJ0LzEyMw/checkout" \
  -H "x-session-id: local-device-session"
```

Response:

```json
{
  "checkoutUrl": "https://your-shop.myshopify.com/..."
}
```

### Expected React Native Backend Flow

1. App fetches products from `GET /api/products`.
2. User selects a product variant from the returned `variants`.
3. App creates a cart through `POST /api/cart`.
4. App adds, updates, or removes lines through the cart line endpoints.
5. App requests a checkout URL through `POST /api/cart/:cartId/checkout`.
6. App opens the returned checkout URL in Shopify Checkout Sheet.

No React Native implementation is included in this backend starter.

## Frontend

The Expo frontend lives in `/app` and calls this backend through `EXPO_PUBLIC_API_BASE_URL`.
It does not call Shopify directly and does not contain Shopify access tokens.

Install and run:

```bash
cd app
npm install
npm run start
```

Required app env:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

Use your computer LAN IP when testing on a physical device. `localhost` points to the phone, not
your laptop.

Frontend flow:

1. Home fetches products from `GET /api/products`.
2. Debounced search refetches products with React Query.
3. Add to cart uses Zustand for optimistic local state and syncs through backend cart endpoints.
4. Cart checkout requests `POST /api/cart/:cartId/checkout`.
5. Shopify checkout opens with Shopify Checkout Sheet Kit.
6. Completion is detected through Checkout Sheet lifecycle events in the POC; production should
   reconcile orders through customer auth or webhooks.
7. Orders uses demo backend order endpoints because Shopify Storefront API cannot fetch anonymous
   customer order history.
8. Purchase again requests backend rebuy lines and attempts to sync them into the Shopify cart.

Frontend structure:

```text
/app
  /app
    /(tabs)
      index.tsx
      orders.tsx
    /cart
      index.tsx
      checkout.tsx
      order-complete.tsx
  /src
    /shared
    /features
      /products
      /cart
      /orders
```
