import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  CROWLLM_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  CONTACT_TO_EMAIL: z.string().email().default('contact@mdabdullah.dev'),
  CONTACT_FROM_EMAIL: z.string().default('Portfolio <onboarding@resend.dev>'),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
