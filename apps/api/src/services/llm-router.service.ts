import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import {
  AiRoutingSchema,
  DEFAULT_AI_ROUTING,
  type AiProvider,
  type AiRouting,
} from '@portfolio/shared';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { generateWithCrowLlm, type CrowLlmMessage } from './crowllm.service.js';

export function getAvailableProviders(): Record<AiProvider, boolean> {
  return {
    gemini: Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY),
    crowllm: Boolean(env.CROWLLM_API_KEY),
  };
}

export async function getAiRouting(): Promise<AiRouting> {
  const { data } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('blueprint')
    .eq('slug', 'default')
    .maybeSingle();

  const bp = (data?.blueprint as { ai_routing?: unknown } | null) ?? null;
  const parsed = AiRoutingSchema.safeParse(bp?.ai_routing);
  return parsed.success ? parsed.data : DEFAULT_AI_ROUTING;
}

export async function saveAiRouting(routing: AiRouting): Promise<AiRouting> {
  const validated = AiRoutingSchema.parse(routing);
  const { data: current } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('blueprint')
    .eq('slug', 'default')
    .maybeSingle();

  const existingBp =
    current?.blueprint && typeof current.blueprint === 'object'
      ? (current.blueprint as Record<string, unknown>)
      : {};

  const { error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .update({
      blueprint: { ...existingBp, ai_routing: validated },
      updated_at: new Date().toISOString(),
    })
    .eq('slug', 'default');

  if (error) throw error;
  return validated;
}

export async function runLlm(options: {
  provider: AiProvider;
  model: string;
  system?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  prompt?: string;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
}): Promise<{ text: string; usage?: unknown; model: string; provider: AiProvider }> {
  const { provider, model, system, messages, prompt, temperature, timeoutMs = 60_000, maxRetries = 2 } = options;

  if (provider === 'crowllm') {
    const crowMessages: CrowLlmMessage[] = [];
    if (system) crowMessages.push({ role: 'system', content: system });
    if (messages && messages.length > 0) {
      crowMessages.push(...messages);
    } else if (prompt) {
      crowMessages.push({ role: 'user', content: prompt });
    }

    const res = await generateWithCrowLlm({
      model,
      messages: crowMessages,
      temperature,
      timeoutMs,
    });
    return { text: res.text, usage: res.usage, model: res.model, provider: 'crowllm' };
  }

  // Google Gemini
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not configured in apps/api/.env');
  }

  const res = messages && messages.length > 0
    ? await generateText({
        model: google(model),
        system,
        messages,
        ...(temperature !== undefined ? { temperature } : {}),
        abortSignal: AbortSignal.timeout(timeoutMs),
        maxRetries,
      })
    : await generateText({
        model: google(model),
        system,
        prompt: prompt ?? '',
        ...(temperature !== undefined ? { temperature } : {}),
        abortSignal: AbortSignal.timeout(timeoutMs),
        maxRetries,
      });

  return { text: res.text, usage: res.usage, model, provider: 'gemini' };
}
