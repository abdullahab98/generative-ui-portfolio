import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client for trusted Express backend operations (never expose to browser)
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
