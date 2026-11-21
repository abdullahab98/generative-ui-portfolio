import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstile(req: Request, res: Response, next: NextFunction) {
  if (!env.TURNSTILE_SECRET_KEY) {
    next();
    return;
  }

  const token = req.body?.turnstile_token;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Missing Cloudflare Turnstile verification token' });
    return;
  }

  const remoteIp =
    (req.headers['cf-connecting-ip'] as string | undefined) ||
    req.ip ||
    undefined;

  const formData = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (remoteIp) formData.set('remoteip', remoteIp);

  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  const data = (await resp.json()) as TurnstileResponse;
  if (!data.success) {
    res.status(403).json({ error: 'Bot verification failed', codes: data['error-codes'] ?? [] });
    return;
  }

  next();
}
