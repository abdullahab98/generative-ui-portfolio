import { env } from '../config/env.js';

export const CROWLLM_MODEL = 'openai/gpt-oss-20b:free';
const CROWLLM_ENDPOINT = 'https://crowllm.com/v1/chat/completions';

export type CrowLlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type CrowLlmResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: unknown;
  error?: {
    message?: string;
  };
};

/** Call CrowLLM's OpenAI-compatible chat completions endpoint. */
export async function generateWithCrowLlm(options: {
  messages: CrowLlmMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
}): Promise<{ text: string; usage?: unknown; model: string }> {
  if (!env.CROWLLM_API_KEY) {
    throw new Error('CROWLLM_API_KEY is not configured in apps/api/.env');
  }

  const model = options.model || CROWLLM_MODEL;
  const res = await fetch(CROWLLM_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.CROWLLM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 16384,
      reasoning_effort: 'low',
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
  });

  const data = (await res.json().catch(() => ({}))) as CrowLlmResponse;
  if (!res.ok) {
    const msg = data?.error?.message || `CrowLLM API error (${res.status})`;
    throw new Error(msg);
  }

  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) {
    throw new Error('CrowLLM returned an empty response');
  }

  return {
    text,
    usage: data.usage,
    model: data.model || model,
  };
}
