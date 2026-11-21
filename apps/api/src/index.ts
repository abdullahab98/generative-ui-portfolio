import { env } from './config/env.js';
import { app } from './app.js';

app.listen(env.PORT, () => {
  console.info(`[portfolio-api] listening on http://localhost:${env.PORT}`);
});
