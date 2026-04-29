import '@shopify/shopify-api/adapters/node';
import {
  GraphqlQueryError,
  HttpMaxRetriesError,
  HttpRequestError,
  HttpResponseError,
  LogSeverity,
  shopifyApi
} from '@shopify/shopify-api';
import type { ApiVersion, Shopify } from '@shopify/shopify-api';
import type { AppConfig } from '../../../config/env.js';
import {
  UpstreamError,
  UpstreamTimeoutError,
  UpstreamUnavailableError
} from '../../../shared/errors/app-error.js';

type RequestOptions = {
  retriable?: boolean;
};

export type CircuitBreakerState = {
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  openedUntil: number | null;
};

type AdminClientConfig = Pick<
  AppConfig,
  | 'SHOPIFY_STORE_DOMAIN'
  | 'SHOPIFY_CLIENT_ID'
  | 'SHOPIFY_CLIENT_SECRET'
  | 'SHOPIFY_ADMIN_ACCESS_TOKEN'
  | 'SHOPIFY_API_VERSION'
  | 'SHOPIFY_APP_HOST_NAME'
  | 'SHOPIFY_ADMIN_TIMEOUT_MS'
  | 'SHOPIFY_ADMIN_READ_RETRIES'
  | 'SHOPIFY_CIRCUIT_FAILURE_THRESHOLD'
  | 'SHOPIFY_CIRCUIT_OPEN_MS'
>;

export class ShopifyAdminClient {
  private readonly shopify: Shopify;
  private circuitState: CircuitBreakerState['state'] = 'closed';
  private failures = 0;
  private openedUntil: number | null = null;

  constructor(private readonly config: AdminClientConfig) {
    this.shopify = shopifyApi({
      apiKey: config.SHOPIFY_CLIENT_ID,
      apiSecretKey: config.SHOPIFY_CLIENT_SECRET,
      adminApiAccessToken: config.SHOPIFY_ADMIN_ACCESS_TOKEN,
      hostName: config.SHOPIFY_APP_HOST_NAME,
      apiVersion: config.SHOPIFY_API_VERSION as ApiVersion,
      isCustomStoreApp: true,
      isEmbeddedApp: false,
      logger: {
        level: LogSeverity.Error,
        httpRequests: false,
        timestamps: false
      },
      scopes: ['read_products']
    });
  }

  async request<TData, TVariables extends Record<string, unknown>>(
    query: string,
    variables: TVariables,
    options: RequestOptions = {}
  ): Promise<TData> {
    this.assertCircuitAllowsRequest();
    const maxAttempts = options.retriable ? this.config.SHOPIFY_ADMIN_READ_RETRIES + 1 : 1;
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
    const timeout = setTimeout(() => controller.abort(), this.config.SHOPIFY_ADMIN_TIMEOUT_MS);
    const session = this.shopify.session.customAppSession(this.config.SHOPIFY_STORE_DOMAIN);
    const client = new this.shopify.clients.Graphql({ session });

    try {
      const response = await client.request<TData>(query, {
        variables,
        retries: 0,
        signal: controller.signal
      });

      if (!response.data) {
        throw new UpstreamError('Shopify Admin API response did not include data');
      }

      return response.data;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        throw new UpstreamTimeoutError('Shopify Admin API request timed out', {
          timeoutMs: this.config.SHOPIFY_ADMIN_TIMEOUT_MS,
          attempt,
          durationMs: Date.now() - startedAt
        });
      }

      throw normalizeShopifyError(error, attempt, Date.now() - startedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertCircuitAllowsRequest(): void {
    const state = this.getCircuitBreakerState();
    if (state.state === 'open') {
      throw new UpstreamUnavailableError('Shopify Admin API circuit breaker is open', {
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

function normalizeShopifyError(error: unknown, attempt: number, durationMs: number): UpstreamError {
  if (error instanceof GraphqlQueryError) {
    const body = error.body as { errors?: { graphQLErrors?: unknown } } | undefined;
    return new UpstreamError('Shopify Admin API returned GraphQL errors', {
      errors: body?.errors?.graphQLErrors,
      attempt,
      durationMs
    });
  }

  if (error instanceof HttpResponseError) {
    const response = error.response as {
      code?: number;
      statusText?: string;
      body?: unknown;
    };
    return new UpstreamError('Shopify Admin API request failed', {
      statusCode: response.code,
      statusText: response.statusText,
      body: response.body,
      attempt,
      durationMs
    });
  }

  if (error instanceof HttpMaxRetriesError || error instanceof HttpRequestError) {
    return new UpstreamError('Shopify Admin API request failed', {
      attempt,
      durationMs
    });
  }

  if (error instanceof UpstreamError) {
    return error;
  }

  return new UpstreamError('Shopify Admin API request failed', {
    attempt,
    durationMs
  });
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
