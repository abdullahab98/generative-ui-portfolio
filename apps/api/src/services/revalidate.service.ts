import { env } from '../config/env.js';

export async function triggerWebRevalidation() {
  if (!env.REVALIDATE_URL || !env.REVALIDATE_SECRET) return;
  try {
    await fetch(env.REVALIDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': env.REVALIDATE_SECRET,
      },
      body: JSON.stringify({ tag: 'portfolio' }),
    });
  } catch (err) {
    console.warn('[revalidate] failed:', err);
  }
}
