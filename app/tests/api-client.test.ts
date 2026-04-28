import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/src/shared/api/client';

describe('apiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes backend error envelopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed'
          }
        })
      })
    );

    await expect(apiRequest('/api/products')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed'
    });
  });
});
