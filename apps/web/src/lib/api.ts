import type { PortfolioPayload } from '@portfolio/shared';
import { FALLBACK_PORTFOLIO } from './fallback-data';
import { supabase } from './supabase';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchPortfolio(): Promise<PortfolioPayload> {
  try {
    const res = await fetch(`${API_URL}/api/v1/portfolio`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as PortfolioPayload;
  } catch {
    return FALLBACK_PORTFOLIO;
  }
}

export async function adminFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let activeToken = token;

  const doFetch = (jwt: string) =>
    fetch(`${API_URL}/api/v1/admin${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        ...(init?.headers ?? {}),
      },
    });

  let res = await doFetch(activeToken);
  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      activeToken = refreshed.session.access_token;
      res = await doFetch(activeToken);
    }
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
