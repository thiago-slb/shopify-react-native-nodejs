import { env } from '../config/env';
import { normalizeApiError } from './errors';

export async function apiRequest<TResponse>(
  path: string,
  init: RequestInit = {}
): Promise<TResponse> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers
    }
  });

  if (!response.ok) {
    throw await normalizeApiError(response);
  }

  return (await response.json()) as TResponse;
}
