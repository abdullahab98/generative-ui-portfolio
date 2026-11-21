import 'dotenv/config';
import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const safeOptionalUrl = (v: unknown) => {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).toString();
  } catch {
    console.warn(`[env] Ignoring invalid optional URL (${trimmed.slice(0, 40)}...)`);
    return undefined;
  }
};

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  GOOGLE_GENERATIVE_AI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CROWLLM_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CONTACT_TO_EMAIL: z.preprocess(emptyToUndefined, z.string().email().default('contact@mdabdullah.dev')),
  CONTACT_FROM_EMAIL: z.preprocess(emptyToUndefined, z.string().default('Portfolio <onboarding@resend.dev>')),
  TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  REVALIDATE_URL: z.preprocess(safeOptionalUrl, z.string().optional()),
  REVALIDATE_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const env = EnvSchema.parse(process.env);
