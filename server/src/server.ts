import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const app = await buildApp({ config });

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error({ err: error }, 'Failed to start server');
  process.exit(1);
}
