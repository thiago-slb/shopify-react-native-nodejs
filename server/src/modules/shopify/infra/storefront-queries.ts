const moneyFields = `
  amount
  currencyCode
`;

const imageFields = `
  url
  altText
  width
  height
`;

const variantFields = `
  id
  title
  availableForSale
  quantityAvailable
  price {
    ${moneyFields}
  }
  selectedOptions {
    name
    value
  }
  image {
    ${imageFields}
  }
`;

const productFields = `
  id
  title
  handle
  description
  availableForSale
  images(first: 10) {
    edges {
      node {
        ${imageFields}
      }
    }
  }
  priceRange {
    minVariantPrice {
      ${moneyFields}
    }
    maxVariantPrice {
      ${moneyFields}
    }
  }
  variants(first: 100) {
    edges {
      node {
        ${variantFields}
      }
    }
  }
`;

const cartFields = `
  id
  checkoutUrl
  totalQuantity
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        cost {
          totalAmount {
            ${moneyFields}
          }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ${moneyFields}
            }
            image {
              ${imageFields}
            }
            product {
              id
              title
              handle
            }
          }
        }
      }
    }
  }
  cost {
    subtotalAmount {
      ${moneyFields}
    }
    totalAmount {
      ${moneyFields}
    }
    totalTaxAmount {
      ${moneyFields}
    }
  }
`;

export const productsQuery = `
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        node {
          ${productFields}
        }
      }
    }
  }
`;

export const productByHandleQuery = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      ${productFields}
    }
  }
`;

export const cartQuery = `
  query Cart($cartId: ID!) {
    cart(id: $cartId) {
      ${cartFields}
    }
  }
`;

export const cartCreateMutation = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ${cartFields}
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const cartLinesAddMutation = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ${cartFields}
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const cartLinesUpdateMutation = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ${cartFields}
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const cartLinesRemoveMutation = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ${cartFields}
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;
