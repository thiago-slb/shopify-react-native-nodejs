export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = 'API_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiErrorPayload = {
  error?: {
    message?: string;
    code?: string;
    details?: unknown;
  };
};

export async function normalizeApiError(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  return new ApiError(
    payload?.error?.message ?? `Request failed with status ${response.status}`,
    response.status,
    payload?.error?.code,
    payload?.error?.details
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
