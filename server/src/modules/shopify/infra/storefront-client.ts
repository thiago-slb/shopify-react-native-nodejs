import type { AppConfig } from '../../../config/env.js';
import { UpstreamError } from '../../../shared/errors/app-error.js';

type GraphQLError = {
  message: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLError[];
};

export class ShopifyStorefrontClient {
  private readonly endpoint: string;

  constructor(
    private readonly config: Pick<
      AppConfig,
      'SHOPIFY_STORE_DOMAIN' | 'SHOPIFY_STOREFRONT_ACCESS_TOKEN' | 'SHOPIFY_STOREFRONT_API_VERSION'
    >
  ) {
    this.endpoint = `https://${config.SHOPIFY_STORE_DOMAIN}/api/${config.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`;
  }

  async request<TData, TVariables extends Record<string, unknown>>(
    query: string,
    variables: TVariables
  ): Promise<TData> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.config.SHOPIFY_STOREFRONT_ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    });

    const body = (await response.json().catch(() => null)) as GraphQLResponse<TData> | null;

    if (!response.ok) {
      throw new UpstreamError('Shopify Storefront API request failed', {
        statusCode: response.status,
        statusText: response.statusText
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
}
