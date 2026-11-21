import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  adminUser?: { id: string; email: string };
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = auth.slice('Bearer '.length).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
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

  req.adminUser = { id: data.user.id, email: adminRow.email };
  next();
}
