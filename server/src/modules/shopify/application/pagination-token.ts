import { BadRequestError } from '../../../shared/errors/app-error.js';

type PaginationToken = {
  version: 1;
  cursor: string;
  direction: 'next' | 'previous';
};

export type DecodedPageToken = {
  cursor: string;
  direction: 'next' | 'previous';
};

export function encodePageToken(
  cursor: string | null,
  direction: PaginationToken['direction']
): string | null {
  if (!cursor) {
    return null;
  }

  const token: PaginationToken = { version: 1, cursor, direction };
  return Buffer.from(JSON.stringify(token), 'utf8').toString('base64url');
}

export function decodePageToken(token: string | undefined): DecodedPageToken | undefined {
  if (!token) {
    return undefined;
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Partial<PaginationToken>;
    if (
      decoded.version !== 1 ||
      typeof decoded.cursor !== 'string' ||
      decoded.cursor.length === 0 ||
      (decoded.direction !== 'next' && decoded.direction !== 'previous')
    ) {
      throw new Error('Invalid token payload');
    }

    return {
      cursor: decoded.cursor,
      direction: decoded.direction
    };
  } catch {
    throw new BadRequestError('Invalid pagination token', undefined, 'INVALID_PAGE_TOKEN');
  }
}
