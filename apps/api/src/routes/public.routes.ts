import { Router, type RequestHandler } from 'express';
import { createHash } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { ChatRequestSchema, ContactSubmitSchema } from '@portfolio/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { validateBody } from '../middleware/validate.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import { getPublicPortfolio } from '../services/portfolio.service.js';
import { sendContactNotification } from '../services/email.service.js';
import { answerPortfolioChat } from '../services/ai.service.js';
import { evolvePortfolioUi, getCachedVisitorDisplayMode } from '../services/ui-evolution.service.js';

export const publicRouter = Router();

const rateLimitMiddleware = (
  typeof rateLimit === 'function'
    ? rateLimit
    : (rateLimit as unknown as { default: (opts: Record<string, unknown>) => RequestHandler }).default
) as (opts: Record<string, unknown>) => RequestHandler;

const strictLimiter = rateLimitMiddleware({
  windowMs: 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
});

publicRouter.get('/portfolio', async (_req, res, next) => {
  try {
    const data = await getPublicPortfolio();
    const mode = getCachedVisitorDisplayMode();
    if (mode === 'single') {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    res.json(data);
    // Non-blocking background UI evolution for the next visitor if cooldown elapsed
    void evolvePortfolioUi(false);
  } catch (err) {
    next(err);
  }
});

publicRouter.post(
  '/contact',
  strictLimiter,
  validateBody(ContactSubmitSchema),
  verifyTurnstile,
  async (req, res, next) => {
    try {
      const { sender_name, sender_email, subject, message } = req.body;
      const ip = (req.headers['cf-connecting-ip'] as string) || req.ip || 'unknown';
      const ip_hash = createHash('sha256').update(ip).digest('hex').slice(0, 16);

      const { error } = await supabaseAdmin.from('contact_messages').insert({
        sender_name,
        sender_email,
        subject,
        message,
        ip_hash,
      });
      if (error) throw error;

      // Best-effort email notification
      await sendContactNotification({ sender_name, sender_email, subject, message }).catch((e) =>
        console.warn('[email] notification failed:', e)
      );

      res.status(201).json({ ok: true, message: 'Message received. Thank you for reaching out!' });
    } catch (err) {
      next(err);
    }
  }
);

publicRouter.post(
  '/chat',
  strictLimiter,
  validateBody(ChatRequestSchema),
  verifyTurnstile,
  async (req, res, next) => {
    try {
      const reply = await answerPortfolioChat(req.body.messages);
      res.json({ reply });
    } catch (err) {
      next(err);
    }
  }
);
