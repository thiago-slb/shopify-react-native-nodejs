export type Money = {
  amount: string;
  currencyCode: string;
};

export type ProductImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: Money;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
};

export type Product = {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  images: ProductImage[];
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
  variants: ProductVariant[];
};

export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
};

export type ProductConnection = {
  items: Product[];
  pageInfo: PageInfo;
};

export type ProductListParams = {
  first?: number;
  after?: string;
  query?: string;
};
