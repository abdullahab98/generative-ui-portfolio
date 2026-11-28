import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  adminUser?: { id: string; email: string };
}

const ADMIN_TOKEN_CACHE_TTL_MS = 60_000;
const verifiedAdminCache = new Map<string, { user: { id: string; email: string }; expiresAt: number }>();

function getJwtExpMs(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + ADMIN_TOKEN_CACHE_TTL_MS;
  } catch {
    return Date.now() + ADMIN_TOKEN_CACHE_TTL_MS;
  }
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = auth.slice('Bearer '.length).trim();
  const tokenKey = createHash('sha256').update(token).digest('hex');
  const cached = verifiedAdminCache.get(tokenKey);
  if (cached && cached.expiresAt > Date.now()) {
    req.adminUser = cached.user;
    next();
    return;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    verifiedAdminCache.delete(tokenKey);
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const { data: adminRow, error: adminErr } = await supabaseAdmin
    .from('admin_users')
    .select('user_id, email, role')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (adminErr || !adminRow) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return;
  }

  const adminUser = { id: data.user.id, email: adminRow.email };
  if (verifiedAdminCache.size >= 50) {
    const oldestKey = verifiedAdminCache.keys().next().value;
    if (oldestKey) verifiedAdminCache.delete(oldestKey);
  }
  verifiedAdminCache.set(tokenKey, {
    user: adminUser,
    expiresAt: Math.min(Date.now() + ADMIN_TOKEN_CACHE_TTL_MS, getJwtExpMs(token)),
  });

  req.adminUser = adminUser;
  next();
}
