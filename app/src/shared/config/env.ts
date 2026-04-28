const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  console.warn('EXPO_PUBLIC_API_BASE_URL is not set. Configure it in app/.env for device testing.');
}

export const env = {
  apiBaseUrl: apiBaseUrl ?? 'http://localhost:3000'
};
