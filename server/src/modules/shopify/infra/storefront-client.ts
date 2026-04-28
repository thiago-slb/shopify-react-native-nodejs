import type { AppConfig } from '../../../config/env.js';
import {
  UpstreamError,
  UpstreamTimeoutError,
  UpstreamUnavailableError
} from '../../../shared/errors/app-error.js';

type GraphQLError = {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLError[];
};

type RequestOptions = {
  retriable?: boolean;
};

export type CircuitBreakerState = {
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  openedUntil: number | null;
};

export class ShopifyStorefrontClient {
  private readonly endpoint: string;
  private circuitState: CircuitBreakerState['state'] = 'closed';
  private failures = 0;
  private openedUntil: number | null = null;

  constructor(
    private readonly config: Pick<
      AppConfig,
      | 'SHOPIFY_STORE_DOMAIN'
      | 'SHOPIFY_STOREFRONT_ACCESS_TOKEN'
      | 'SHOPIFY_STOREFRONT_API_VERSION'
      | 'SHOPIFY_STOREFRONT_TIMEOUT_MS'
      | 'SHOPIFY_STOREFRONT_READ_RETRIES'
      | 'SHOPIFY_CIRCUIT_FAILURE_THRESHOLD'
      | 'SHOPIFY_CIRCUIT_OPEN_MS'
    >
  ) {
    this.endpoint = `https://${config.SHOPIFY_STORE_DOMAIN}/api/${config.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`;
  }

  async request<TData, TVariables extends Record<string, unknown>>(
    query: string,
    variables: TVariables,
    options: RequestOptions = {}
  ): Promise<TData> {
    this.assertCircuitAllowsRequest();
    const maxAttempts = options.retriable ? this.config.SHOPIFY_STOREFRONT_READ_RETRIES + 1 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const data = await this.fetchOnce<TData, TVariables>(query, variables, attempt);
        this.recordSuccess();
        return data;
      } catch (error) {
        lastError = error;
        if (!options.retriable || attempt >= maxAttempts || !isRetriableError(error)) {
          this.recordFailure(error);
          throw error;
        }

        await sleep(backoffMs(attempt));
      }
    }

    throw lastError;
  }

  getCircuitBreakerState(): CircuitBreakerState {
    if (this.circuitState === 'open' && this.openedUntil && Date.now() >= this.openedUntil) {
      return {
        state: 'half_open',
        failures: this.failures,
        openedUntil: this.openedUntil
      };
    }

    return {
      state: this.circuitState,
      failures: this.failures,
      openedUntil: this.openedUntil
    };
  }

  private async fetchOnce<TData, TVariables extends Record<string, unknown>>(
    query: string,
    variables: TVariables,
    attempt: number
  ): Promise<TData> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.SHOPIFY_STOREFRONT_TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.config.SHOPIFY_STOREFRONT_ACCESS_TOKEN
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new UpstreamTimeoutError('Shopify Storefront API request timed out', {
          timeoutMs: this.config.SHOPIFY_STOREFRONT_TIMEOUT_MS,
          attempt,
          durationMs: Date.now() - startedAt
        });
      }

      throw new UpstreamError('Shopify Storefront API request failed', {
        attempt,
        durationMs: Date.now() - startedAt
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = (await response.json().catch(() => null)) as GraphQLResponse<TData> | null;

    if (!response.ok) {
      throw new UpstreamError('Shopify Storefront API request failed', {
        statusCode: response.status,
        statusText: response.statusText,
        attempt,
        durationMs: Date.now() - startedAt
      });
    }

    if (!body) {
      throw new UpstreamError('Shopify Storefront API returned an invalid response');
    }

    if (body.errors?.length) {
      throw new UpstreamError('Shopify Storefront API returned GraphQL errors', {
        errors: body.errors.map((error) => ({
          message: error.message,
          path: error.path,
          extensions: error.extensions
        }))
      });
    }

    if (!body.data) {
      throw new UpstreamError('Shopify Storefront API response did not include data');
    }

    return body.data;
  }

  private assertCircuitAllowsRequest(): void {
    const state = this.getCircuitBreakerState();
    if (state.state === 'open') {
      throw new UpstreamUnavailableError('Shopify Storefront API circuit breaker is open', {
        circuitBreaker: state
      });
    }

    if (state.state === 'half_open') {
      this.circuitState = 'half_open';
    }
  }

  private recordSuccess(): void {
    this.circuitState = 'closed';
    this.failures = 0;
    this.openedUntil = null;
  }

  private recordFailure(error: unknown): void {
    if (!isRetriableError(error)) {
      return;
    }

    this.failures += 1;
    if (this.failures >= this.config.SHOPIFY_CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitState = 'open';
      this.openedUntil = Date.now() + this.config.SHOPIFY_CIRCUIT_OPEN_MS;
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRetriableError(error: unknown): boolean {
  if (error instanceof UpstreamTimeoutError) {
    return true;
  }

  return error instanceof UpstreamError;
}

function backoffMs(attempt: number): number {
  return Math.min(100 * 2 ** (attempt - 1), 1000);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
