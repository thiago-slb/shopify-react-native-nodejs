import { BadRequestError } from '../../../shared/errors/app-error.js';

type PublicIdType = 'product' | 'variant' | 'cart' | 'cartLine';

const publicIdPrefixes: Record<PublicIdType, string> = {
  product: 'prod',
  variant: 'var',
  cart: 'cart',
  cartLine: 'cline'
};

const gidTypes: Record<PublicIdType, string> = {
  product: 'Product',
  variant: 'ProductVariant',
  cart: 'Cart',
  cartLine: 'CartLine'
};

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestError('Invalid identifier', undefined, 'INVALID_ID');
  }
}

export function encodePublicId(type: PublicIdType, gid: string): string {
  return `${publicIdPrefixes[type]}_${encode(gid)}`;
}

export function decodePublicId(type: PublicIdType, id: string): string {
  if (id.startsWith('gid://shopify/')) {
    return assertGidType(type, id);
  }

  const prefix = `${publicIdPrefixes[type]}_`;
  if (!id.startsWith(prefix)) {
    throw new BadRequestError('Invalid identifier', undefined, 'INVALID_ID');
  }

  return assertGidType(type, decode(id.slice(prefix.length)));
}

function assertGidType(type: PublicIdType, gid: string): string {
  if (!gid.startsWith(`gid://shopify/${gidTypes[type]}/`)) {
    throw new BadRequestError('Invalid identifier', undefined, 'INVALID_ID');
  }

  return gid;
}

