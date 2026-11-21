import type { ChatRequest } from '@portfolio/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { getAiRouting, runLlm } from './llm-router.service.js';
import { getPublicPortfolio } from './portfolio.service.js';

export async function answerPortfolioChat(messages: ChatRequest['messages']): Promise<string> {
  const [{ data: settings }, portfolio, routing] = await Promise.all([
    supabaseAdmin.from('ai_settings').select('*').eq('slug', 'default').maybeSingle(),
    getPublicPortfolio(),
    getAiRouting(),
  ]);

  if (settings && !settings.is_enabled) {
    return 'The AI assistant is currently disabled by the site administrator.';
  }

  const systemPrompt = [
    settings?.system_prompt ??
      "You are the portfolio AI assistant for Md. Abdullah. Answer concisely using only the provided portfolio context.",
    '',
    'LIVE PORTFOLIO CONTEXT (JSON):',
    JSON.stringify({
      profile: {
        name: portfolio.profile.name,
        tagline: portfolio.profile.tagline,
        bio: portfolio.profile.bio,
        location: portfolio.profile.location,
        availability: portfolio.profile.availability_status,
        email: portfolio.profile.email,
        github: portfolio.profile.github_url,
        linkedin: portfolio.profile.linkedin_url,
        highlights: portfolio.profile.about_highlights,
      },
      skills: portfolio.skills.map((s) => `${s.name} (${s.category}, ${s.level})`),
      projects: portfolio.projects.map((p) => ({
        title: p.title,
        category: p.category,
        summary: p.summary,
        tech: p.tech_stack,
        live_url: p.live_url,
        github_url: p.github_url,
      })),
      publications: portfolio.publications.map((pub) => ({
        title: pub.title,
        venue: pub.venue,
        year: pub.published_year,
        authors: pub.authors,
        paper_url: pub.paper_url,
      })),
    }),
  ].join('\n');

  const result = await runLlm({
    provider: routing.chat_provider,
    model: routing.chat_model,
    system: systemPrompt,
    messages,
    timeoutMs: 25_000,
  });

  return result.text;
}
