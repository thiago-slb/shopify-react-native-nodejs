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

SHOPIFY_STORE_DOMAIN=your-shop.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_storefront_access_token
SHOPIFY_STOREFRONT_API_VERSION=2025-01
```

`SHOPIFY_STORE_DOMAIN` should be the store domain without `https://`. The token must be a
Storefront API access token, not an Admin API token.

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

When the server is running, Swagger UI is available at:

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

Shopify GraphQL edges and nodes are normalized into app-friendly DTOs. Product responses include
variant IDs so the mobile app can pass a `merchandiseId` when creating or changing cart lines.
Shopify `userErrors` are returned as backend `400` errors with a stable error envelope.

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
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      {
        "merchandiseId": "gid://shopify/ProductVariant/123",
        "quantity": 1
      }
    ]
  }'
```

Fetch a cart:

```bash
curl "http://localhost:3000/api/cart/gid%3A%2F%2Fshopify%2FCart%2F123"
```

Add cart lines:

```bash
curl -X POST "http://localhost:3000/api/cart/gid%3A%2F%2Fshopify%2FCart%2F123/lines" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      {
        "merchandiseId": "gid://shopify/ProductVariant/456",
        "quantity": 1
      }
    ]
  }'
```

Update cart lines:

```bash
curl -X PATCH "http://localhost:3000/api/cart/gid%3A%2F%2Fshopify%2FCart%2F123/lines" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      {
        "id": "gid://shopify/CartLine/789",
        "merchandiseId": "gid://shopify/ProductVariant/456",
        "quantity": 2
      }
    ]
  }'
```

Remove cart lines:

```bash
curl -X DELETE "http://localhost:3000/api/cart/gid%3A%2F%2Fshopify%2FCart%2F123/lines" \
  -H "Content-Type: application/json" \
  -d '{
    "lineIds": ["gid://shopify/CartLine/789"]
  }'
```

Get checkout URL:

```bash
curl -X POST "http://localhost:3000/api/cart/gid%3A%2F%2Fshopify%2FCart%2F123/checkout"
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
