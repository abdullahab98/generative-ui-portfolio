import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { publicRouter } from './routes/public.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'portfolio-api', timestamp: new Date().toISOString() });
});

app.use('/api/v1', publicRouter);
app.use('/api/v1/admin', adminRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api-error]', err);
  const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(status).json({ error: env.NODE_ENV === 'production' && status === 500 ? 'Internal server error' : message });
});
