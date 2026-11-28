import type { PortfolioPayload } from '@portfolio/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { getPortfolioUiStateForVisitor } from './ui-evolution.service.js';

const CONTENT_CACHE_TTL_MS = 30_000;
type StaticPortfolioContent = Omit<PortfolioPayload, 'uiState'>;
let contentCache: { expiresAt: number; data: StaticPortfolioContent } | null = null;

export function invalidatePortfolioContentCache(): void {
  contentCache = null;
}

async function getStaticPortfolioContent(): Promise<StaticPortfolioContent> {
  if (contentCache && contentCache.expiresAt > Date.now()) {
    return contentCache.data;
  }

  const [profileRes, skillsRes, projectsRes, publicationsRes, aiRes] = await Promise.all([
    supabaseAdmin.from('site_profile').select('*').eq('slug', 'main').single(),
    supabaseAdmin
      .from('skills')
      .select('*')
      .eq('is_visible', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('projects')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('publications')
      .select('*')
      .eq('is_published', true)
      .order('published_year', { ascending: false })
      .order('sort_order', { ascending: true }),
    supabaseAdmin.from('ai_settings').select('is_enabled, quick_prompts').eq('slug', 'default').maybeSingle(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (skillsRes.error) throw skillsRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (publicationsRes.error) throw publicationsRes.error;

  const data: StaticPortfolioContent = {
    profile: profileRes.data,
    skills: skillsRes.data ?? [],
    projects: projectsRes.data ?? [],
    publications: publicationsRes.data ?? [],
    ai: {
      is_enabled: aiRes.data?.is_enabled ?? true,
      quick_prompts: aiRes.data?.quick_prompts ?? [],
    },
  };
  contentCache = { expiresAt: Date.now() + CONTENT_CACHE_TTL_MS, data };
  return data;
}

export async function getPublicPortfolio(): Promise<PortfolioPayload> {
  const [content, uiState] = await Promise.all([
    getStaticPortfolioContent(),
    getPortfolioUiStateForVisitor(),
  ]);

  return {
    ...content,
    uiState,
  };
}
