import type { PortfolioPayload } from '@portfolio/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { getPortfolioUiStateForVisitor } from './ui-evolution.service.js';

export async function getPublicPortfolio(): Promise<PortfolioPayload> {
  const [profileRes, skillsRes, projectsRes, publicationsRes, aiRes, uiState] = await Promise.all([
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
    getPortfolioUiStateForVisitor(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (skillsRes.error) throw skillsRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (publicationsRes.error) throw publicationsRes.error;

  return {
    profile: profileRes.data,
    skills: skillsRes.data ?? [],
    projects: projectsRes.data ?? [],
    publications: publicationsRes.data ?? [],
    ai: {
      is_enabled: aiRes.data?.is_enabled ?? true,
      quick_prompts: aiRes.data?.quick_prompts ?? [],
    },
    uiState,
  };
}
