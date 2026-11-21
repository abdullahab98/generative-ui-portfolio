import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  DEFAULT_UI_DISPLAY_CONFIG,
  PortfolioThemeSpecSchema,
  PortfolioUiStateSchema,
  UiDisplayConfigSchema,
  UiGenerationLogSchema,
  resolveSkillIconUrl,
  type PortfolioThemeSpec,
  type PortfolioUiState,
  type SavedUiTemplateSummary,
  type UiDisplayConfig,
  type UiGenerationLog,
  type UiGenerationStageLog,
} from '@portfolio/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { getAiRouting, getAvailableProviders, runLlm } from './llm-router.service.js';
import { triggerWebRevalidation } from './revalidate.service.js';

let isMutating = false;

const ExtendedMetaSchema = PortfolioThemeSpecSchema.extend({
  layoutSignature: z.string().min(4).max(120).optional(),
});

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function pickReadableInk(bg: string, candidate: string): string {
  if (contrastRatio(bg, candidate) >= 4.5) return candidate;
  return contrastRatio(bg, '#fafafa') >= contrastRatio(bg, '#09090b') ? '#fafafa' : '#09090b';
}

function ensureReadableTheme(theme: PortfolioThemeSpec): PortfolioThemeSpec {
  return {
    ...theme,
    ink: pickReadableInk(theme.surface, theme.ink),
    accentInk: pickReadableInk(theme.accent, theme.accentInk),
  };
}

/**
 * Strip scripts/iframes/inline handlers for XSS safety, and inject smooth anchor
 * scrolling + scroll-margin-top so sticky navbars never cover target sections.
 */
export function sanitizeGeneratedHtml(html: string): string {
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '#');

  const navFixCss =
    '<style>html{scroll-behavior:smooth;}section,[id]{scroll-margin-top:80px;}</style>';
  return /<\/head>/i.test(cleaned)
    ? cleaned.replace(/<\/head>/i, `${navFixCss}</head>`)
    : `${navFixCss}${cleaned}`;
}

function extractHtmlAndTheme(rawText: string, fallbackTheme: PortfolioThemeSpec) {
  let theme = fallbackTheme;
  let layoutSignature = 'custom-layout';
  const metaMatch = rawText.match(/<!--\s*THEME_META\s*(\{[\s\S]*?\})\s*-->/i);
  if (metaMatch) {
    try {
      const parsed = ExtendedMetaSchema.safeParse(JSON.parse(metaMatch[1]));
      if (parsed.success) {
        if (parsed.data.layoutSignature) layoutSignature = parsed.data.layoutSignature;
        theme = ensureReadableTheme(parsed.data);
      }
    } catch {
      // keep fallback theme metadata if comment JSON is malformed
    }
  }

  const stripped = rawText
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const docMatch = stripped.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) || stripped.match(/<html[\s\S]*<\/html>/i);
  const html = docMatch ? docMatch[0] : stripped;
  return { theme, layoutSignature, html: sanitizeGeneratedHtml(html) };
}

const MIN_AUTO_COOLDOWN_SEC = 20 * 60; // 20 minutes minimum between automatic generations
let lastServedEpoch: number | null = null;
let remainingEpochs: number[] = [];
let serialCursor = 0;

type SavedTemplate = {
  epoch_number: number;
  theme: PortfolioThemeSpec;
  model_name?: string;
  generated_html: string;
};

function parseSavedTemplates(
  rawRow: Record<string, unknown>,
  baseState: PortfolioUiState,
): SavedTemplate[] {
  const bp = (rawRow.blueprint as Record<string, unknown> | null) ?? {};
  const byEpoch = new Map<number, SavedTemplate>();

  if (Array.isArray(bp.saved_templates)) {
    for (const item of bp.saved_templates) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const themeParsed = PortfolioThemeSpecSchema.safeParse(rec.theme);
      if (
        typeof rec.epoch_number === 'number' &&
        themeParsed.success &&
        typeof rec.generated_html === 'string' &&
        rec.generated_html.length >= 300
      ) {
        byEpoch.set(rec.epoch_number, {
          epoch_number: rec.epoch_number,
          theme: themeParsed.data,
          model_name: typeof rec.model_name === 'string' ? rec.model_name : undefined,
          generated_html: rec.generated_html,
        });
      }
    }
  }

  // Also backfill from successful generation_logs if not already in saved_templates
  for (const log of parseGenerationLogs(bp)) {
    if (log.status !== 'success' || !log.stage2?.response || byEpoch.has(log.epoch_number)) continue;
    const extracted = extractHtmlAndTheme(log.stage2.response, baseState.theme);
    if (extracted.html.length >= 300) {
      byEpoch.set(log.epoch_number, {
        epoch_number: log.epoch_number,
        theme: extracted.theme,
        model_name: `${log.stage2.provider}:${log.stage2.model}`,
        generated_html: extracted.html,
      });
    }
  }

  if (baseState.generated_html && baseState.generated_html.length >= 300 && !byEpoch.has(baseState.epoch_number)) {
    byEpoch.set(baseState.epoch_number, {
      epoch_number: baseState.epoch_number,
      theme: baseState.theme,
      model_name: baseState.model_name,
      generated_html: baseState.generated_html,
    });
  }

  return Array.from(byEpoch.values()).sort((a, b) => b.epoch_number - a.epoch_number);
}

function parseUiStateRow(data: Record<string, unknown> | null): PortfolioUiState | undefined {
  if (!data) return undefined;
  const bp = data.blueprint as { model_name?: string; show_ai_bar?: boolean } | null | undefined;
  const parsed = PortfolioUiStateSchema.safeParse({
    ...data,
    model_name: typeof bp?.model_name === 'string' ? bp.model_name : undefined,
    show_ai_bar: typeof bp?.show_ai_bar === 'boolean' ? bp.show_ai_bar : true,
  });
  return parsed.success ? parsed.data : undefined;
}

export async function getPortfolioUiState(): Promise<PortfolioUiState | undefined> {
  const { data, error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('*')
    .eq('slug', 'default')
    .maybeSingle();

  if (error || !data) return undefined;
  return parseUiStateRow(data as Record<string, unknown>);
}

function parseDisplayConfig(blueprint: unknown): UiDisplayConfig {
  const raw = (blueprint as { display_config?: unknown } | null)?.display_config;
  const parsed = UiDisplayConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UI_DISPLAY_CONFIG;
}

export async function getUiDisplayAdminData(): Promise<{
  templates: SavedUiTemplateSummary[];
  displayConfig: UiDisplayConfig;
}> {
  const { data, error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('*')
    .eq('slug', 'default')
    .maybeSingle();

  if (error || !data) {
    return { templates: [], displayConfig: DEFAULT_UI_DISPLAY_CONFIG };
  }
  const rawRow = data as Record<string, unknown>;
  const baseState = parseUiStateRow(rawRow);
  if (!baseState) {
    return { templates: [], displayConfig: DEFAULT_UI_DISPLAY_CONFIG };
  }

  const templates = parseSavedTemplates(rawRow, baseState);
  return {
    templates: templates.map((t) => ({
      epoch_number: t.epoch_number,
      theme: t.theme,
      model_name: t.model_name,
      html_length: t.generated_html.length,
    })),
    displayConfig: parseDisplayConfig(rawRow.blueprint),
  };
}

export async function saveUiDisplayConfig(config: UiDisplayConfig): Promise<{
  templates: SavedUiTemplateSummary[];
  displayConfig: UiDisplayConfig;
}> {
  const validated = UiDisplayConfigSchema.parse(config);
  const { data: current } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('*')
    .eq('slug', 'default')
    .maybeSingle();

  const existingBp =
    current?.blueprint && typeof current.blueprint === 'object'
      ? (current.blueprint as Record<string, unknown>)
      : {};

  // Reset in-memory rotation state so new mode/selection takes effect immediately
  remainingEpochs = [];
  serialCursor = 0;

  const updatePayload: Record<string, unknown> = {
    blueprint: { ...existingBp, display_config: validated },
    updated_at: new Date().toISOString(),
  };

  // In single mode, also sync the active row's theme & generated_html to the pinned template
  if (validated.mode === 'single' && validated.pinned_epoch && current) {
    const rawRow = current as Record<string, unknown>;
    const baseState = parseUiStateRow(rawRow);
    if (baseState) {
      const templates = parseSavedTemplates(rawRow, baseState);
      const pinned = templates.find((t) => t.epoch_number === validated.pinned_epoch);
      if (pinned) {
        updatePayload.epoch_number = pinned.epoch_number;
        updatePayload.theme = pinned.theme;
        updatePayload.generated_html = pinned.generated_html;
        updatePayload.blueprint = {
          ...existingBp,
          model_name: pinned.model_name ?? existingBp.model_name,
          display_config: validated,
        };
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .update(updatePayload)
    .eq('slug', 'default');
  if (error) throw error;

  await triggerWebRevalidation();
  return getUiDisplayAdminData();
}

export async function deleteSavedUiTemplate(epochNumber: number): Promise<{
  templates: SavedUiTemplateSummary[];
  displayConfig: UiDisplayConfig;
}> {
  const { data: current, error: readErr } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('*')
    .eq('slug', 'default')
    .maybeSingle();

  if (readErr || !current) throw new Error('UI state not found');
  const rawRow = current as Record<string, unknown>;
  const baseState = parseUiStateRow(rawRow);
  if (!baseState) throw new Error('Invalid UI state');

  const templates = parseSavedTemplates(rawRow, baseState);
  const remaining = templates.filter((t) => t.epoch_number !== epochNumber);
  if (remaining.length === 0) {
    throw new Error('Cannot delete the last remaining template.');
  }

  const existingBp =
    rawRow.blueprint && typeof rawRow.blueprint === 'object'
      ? (rawRow.blueprint as Record<string, unknown>)
      : {};
  const config = parseDisplayConfig(existingBp);
  const nextConfig: UiDisplayConfig = {
    ...config,
    pinned_epoch: config.pinned_epoch === epochNumber ? remaining[0].epoch_number : config.pinned_epoch,
    selected_epochs: config.selected_epochs.filter((ep) => ep !== epochNumber),
  };

  const nextActive = baseState.epoch_number === epochNumber ? remaining[0] : null;
  const updatePayload: Record<string, unknown> = {
    blueprint: {
      ...existingBp,
      saved_templates: remaining,
      display_config: nextConfig,
    },
    updated_at: new Date().toISOString(),
  };

  if (nextActive) {
    updatePayload.epoch_number = nextActive.epoch_number;
    updatePayload.theme = nextActive.theme;
    updatePayload.generated_html = nextActive.generated_html;
  }

  const { error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .update(updatePayload)
    .eq('slug', 'default');
  if (error) throw error;

  remainingEpochs = remainingEpochs.filter((ep) => ep !== epochNumber);
  await triggerWebRevalidation();
  return getUiDisplayAdminData();
}

/** Return the visitor UI according to Admin's Display Mode (single / random / serial) & selected templates. */
export async function getPortfolioUiStateForVisitor(): Promise<PortfolioUiState | undefined> {
  const { data, error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('*')
    .eq('slug', 'default')
    .maybeSingle();

  if (error || !data) return undefined;
  const rawRow = data as Record<string, unknown>;
  const baseState = parseUiStateRow(rawRow);
  if (!baseState) return undefined;

  const templates = parseSavedTemplates(rawRow, baseState);
  if (templates.length === 0) return baseState;

  const byEpoch = new Map(templates.map((t) => [t.epoch_number, t]));
  const config = parseDisplayConfig(rawRow.blueprint);

  // Mode 1: Single pinned UI
  if (config.mode === 'single') {
    const pinned = (config.pinned_epoch ? byEpoch.get(config.pinned_epoch) : undefined) ?? templates[0];
    lastServedEpoch = pinned.epoch_number;
    return {
      ...baseState,
      epoch_number: pinned.epoch_number,
      theme: pinned.theme,
      model_name: pinned.model_name ?? baseState.model_name,
      generated_html: pinned.generated_html,
    };
  }

  // Build active pool from admin's selected_epochs (preserving exact order for serial), fallback to all templates
  const selectedPool = config.selected_epochs
    .map((ep) => byEpoch.get(ep))
    .filter((t): t is SavedTemplate => Boolean(t));
  const activePool = selectedPool.length > 0 ? selectedPool : templates;

  let picked: SavedTemplate;

  if (config.mode === 'serial') {
    // Mode 2: Serial rotation in exact order (0 -> 1 -> 2 -> ... -> 0)
    const idx = serialCursor % activePool.length;
    picked = activePool[idx];
    serialCursor = (idx + 1) % activePool.length;
  } else {
    // Mode 3: Random non-repeating cycle across activePool
    const activeSet = new Set(activePool.map((t) => t.epoch_number));
    remainingEpochs = remainingEpochs.filter((ep) => activeSet.has(ep));

    if (remainingEpochs.length === 0) {
      const allEpochs = activePool.map((t) => t.epoch_number);
      for (let i = allEpochs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allEpochs[i], allEpochs[j]] = [allEpochs[j], allEpochs[i]];
      }
      if (allEpochs.length > 1 && allEpochs[0] === lastServedEpoch) {
        const swapIdx = allEpochs.findIndex((ep) => ep !== lastServedEpoch);
        if (swapIdx > 0) [allEpochs[0], allEpochs[swapIdx]] = [allEpochs[swapIdx], allEpochs[0]];
      }
      remainingEpochs = allEpochs;
    }

    const nextEpoch = remainingEpochs.shift()!;
    picked = byEpoch.get(nextEpoch) ?? activePool[0];
  }

  lastServedEpoch = picked.epoch_number;

  return {
    ...baseState,
    epoch_number: picked.epoch_number,
    theme: picked.theme,
    model_name: picked.model_name ?? baseState.model_name,
    generated_html: picked.generated_html,
  };
}

function parseGenerationLogs(blueprint: unknown): UiGenerationLog[] {
  const rawLogs = (blueprint as { generation_logs?: unknown } | null)?.generation_logs;
  if (!Array.isArray(rawLogs)) return [];
  const logs: UiGenerationLog[] = [];
  for (const item of rawLogs) {
    const parsed = UiGenerationLogSchema.safeParse(item);
    if (parsed.success) logs.push(parsed.data);
  }
  return logs;
}

export async function getUiGenerationLogs(): Promise<UiGenerationLog[]> {
  const { data, error } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('blueprint')
    .eq('slug', 'default')
    .maybeSingle();

  if (error || !data) return [];
  return parseGenerationLogs(data.blueprint);
}

export async function clearUiGenerationLogs(): Promise<void> {
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
      blueprint: { ...existingBp, generation_logs: [] },
      updated_at: new Date().toISOString(),
    })
    .eq('slug', 'default');

  if (error) throw error;
}

export async function evolvePortfolioUi(
  force = false,
  customPrompt?: string
): Promise<PortfolioUiState | null> {
  const routing = await getAiRouting();
  const available = getAvailableProviders();
  if (!available[routing.ui_idea_provider] || !available[routing.ui_gen_provider]) {
    const missing = !available[routing.ui_idea_provider] ? routing.ui_idea_provider : routing.ui_gen_provider;
    if (force) throw new Error(`API key for "${missing}" is not configured in apps/api/.env`);
    return null;
  }
  if (isMutating) {
    if (force) throw Object.assign(new Error('An AI generation is already in progress. Please wait a few seconds and try again.'), { status: 409 });
    return null;
  }

  const { data: rawRow, error: rowErr } = await supabaseAdmin
    .from('portfolio_ui_state')
    .select('*')
    .eq('slug', 'default')
    .maybeSingle();

  if (rowErr) {
    if (force) throw rowErr;
    return null;
  }

  const parsedCurrent = PortfolioUiStateSchema.safeParse(rawRow);
  if (!parsedCurrent.success) {
    if (force) throw new Error(`Invalid portfolio_ui_state row: ${parsedCurrent.error.issues[0]?.message ?? 'schema mismatch'}`);
    return null;
  }
  const current = parsedCurrent.data;

  if (!force && (!current.auto_evolve || new Date(current.next_evolution_at).getTime() > Date.now())) {
    return null;
  }

  const existingBp =
    rawRow && typeof (rawRow as { blueprint?: unknown }).blueprint === 'object' && (rawRow as { blueprint?: unknown }).blueprint !== null
      ? ((rawRow as { blueprint: Record<string, unknown> }).blueprint)
      : {};
  const existingLogs = parseGenerationLogs(existingBp);

  // Read rolling history of last 6 layout signatures from blueprint jsonb
  const recentHistory: Array<{ name: string; surface: string; layoutSignature: string }> =
    Array.isArray(existingBp.history)
      ? (existingBp.history as Array<{ name: string; surface: string; layoutSignature: string }>)
      : [];

  isMutating = true;
  const evolutionStarted = Date.now();
  const trimmedPrompt = customPrompt?.trim();
  let stage1Log: UiGenerationStageLog | null = null;
  let stage2Log: UiGenerationStageLog | null = null;

  try {
    const [profileRes, skillsRes, projectsRes, pubsRes] = await Promise.all([
      supabaseAdmin.from('site_profile').select('*').eq('slug', 'main').single(),
      supabaseAdmin.from('skills').select('*').eq('is_visible', true).order('sort_order', { ascending: true }),
      supabaseAdmin.from('projects').select('*').eq('is_published', true).order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('publications')
        .select('*')
        .eq('is_published', true)
        .order('published_year', { ascending: false }),
    ]);

    const portfolioContext = {
      profile: profileRes.data,
      skills: (skillsRes.data ?? []).map((s) => ({
        ...s,
        icon_url: resolveSkillIconUrl(String(s.name ?? ''), String(s.icon_key ?? '')),
      })),
      projects: projectsRes.data ?? [],
      publications: pubsRes.data ?? [],
    };

    const entropySeed = Math.floor(Math.random() * 1_000_000);

    const historyBlock =
      recentHistory.length > 0
        ? [
            'RECENT DESIGNS YOU MUST NOT REPEAT (invent a completely different layout geometry, nav placement, and color mood from ALL of these):',
            ...recentHistory.map((h, i) => `  ${i + 1}. theme="${h.name}", surface="${h.surface}", layout="${h.layoutSignature}"`),
          ].join('\n')
        : `Previous theme was "${current.theme.name}" (${current.theme.mood}, surface ${current.theme.surface}).`;

    // Stage 1: Ask configured Stage 1 AI for an original Design Idea / Art Direction first
    const ideaPrompt = [
      'You are an award-winning creative director and UI/UX architect.',
      `Creative Seed: #${entropySeed}. Propose ONE fresh, cohesive, high-craft web design concept for a Full-Stack Software Engineer & AI Researcher portfolio.`,
      trimmedPrompt
        ? `ADMIN DIRECTION (must be the core of your concept): ${trimmedPrompt}`
        : [
            historyBlock,
            'STRICT ANTI-REPETITION RULES:',
            '- Invent a brand-new visual aesthetic, color palette (surface, ink, accent, accent2, accentInk), Google Font pairing, and page architecture completely different from ALL recent designs above.',
            '- Vary nav placement (floating bottom dock, sticky top bar, corner pill, split masthead, or horizontal-text sidebar 220px–260px wide — NEVER use narrow rotated/vertical-text side rails).',
            '- Vary surface brightness and hue (warm cream paper, deep emerald, terracotta, crisp white, midnight indigo, brutalist monochrome, etc.).',
          ].join('\n'),
      '',
      'Reply concisely (under 250 words) with:',
      '1. Theme Slug & Mood',
      '2. Exact Hex Palette (surface, ink, accent, accent2, accentInk)',
      '3. Typography Pairing (Google Fonts)',
      '4. Page Layout Architecture & Section Flow (Hero, About, Skills, Projects, Publications, Contact)',
      '5. Desktop Navbar + Theme-Matched Mobile Hamburger Menu Design',
      '6. Signature Visual Details (cards, borders, spacing, accents)',
      '7. Pure CSS Motion & Micro-Interactions (hero entrance, ambient loop, hover lift/glow)',
    ].join('\n');

    const s1Start = Date.now();
    let designIdea: string;
    try {
      const stage1Res = await runLlm({
        provider: routing.ui_idea_provider,
        model: routing.ui_idea_model,
        prompt: ideaPrompt,
        temperature: 1,
        timeoutMs: 30_000,
        maxRetries: 2,
      });
      stage1Log = {
        provider: stage1Res.provider,
        model: stage1Res.model,
        latency_ms: Date.now() - s1Start,
        response: stage1Res.text,
        usage: stage1Res.usage,
      };
      designIdea = stage1Res.text;
    } catch (s1Err) {
      stage1Log = {
        provider: routing.ui_idea_provider,
        model: routing.ui_idea_model,
        latency_ms: Date.now() - s1Start,
        response: '',
        error: s1Err instanceof Error ? s1Err.message : String(s1Err),
      };
      throw s1Err;
    }

    console.log(
      `[ui-evolution] Stage 1 (${routing.ui_idea_provider}:${routing.ui_idea_model}) design idea:`,
      designIdea.slice(0, 200).replace(/\s+/g, ' '),
    );

    // Stage 2: Generate the complete HTML5 + CSS3 UI following Stage 1's design idea
    const prompt = [
      'You are an avant-garde front-end architect. Build a 100% ORIGINAL single-page portfolio in pure HTML5 + embedded CSS (<style> inside <head>) that faithfully executes the Design Idea below.',
      '',
      'MANDATORY DESIGN IDEA TO IMPLEMENT:',
      designIdea.trim(),
      ...(trimmedPrompt ? ['', `ADDITIONAL ADMIN REQUIREMENT: ${trimmedPrompt}`] : []),
      '',
      'STRICT NAVIGATION & LINKING RULES (CRITICAL):',
      '- Every section MUST have its exact lowercase id attribute: id="home", id="about", id="skills", id="projects", id="publications", id="contact".',
      '- Every navbar link and CTA button that scrolls within the page MUST use the exact matching href (`#home`, `#about`, `#skills`, `#projects`, `#publications`, `#contact`). Never invent mismatched hrefs like `#work` or `#capabilities` without matching `id`.',
      '- NAVBAR READABILITY & NO-CLIPPING (CRITICAL): NEVER use sideways or rotated text (`writing-mode: vertical-rl`, `writing-mode: vertical-lr`, or `transform: rotate(...)`) on navbar links or brand names—it causes overlapping and clipped links. All navigation links MUST be normal horizontal readable text. If using a desktop sidebar, give it `width: 220px–260px`, normal horizontal stacked links, and `overflow-y: auto`.',
      '- RESPONSIVE MOBILE NAVBAR (CRITICAL): On desktop, show the full navigation bar. On mobile (<= 768px), show a theme-matched hamburger menu icon button using pure HTML/CSS (e.g. `<input type="checkbox" id="nav-toggle" hidden />` + `<label for="nav-toggle">` or `<details>`/`<summary>`, NO `<script>`) that toggles open the menu items styled to match the current theme. If using `#nav-toggle:checked`, make sure the CSS selector actually matches the menu/sidebar element (e.g. `#nav-toggle:checked ~ * .sidebar` or `body:has(#nav-toggle:checked) .sidebar`). Ensure `overflow-x: hidden` on `body`.',
      '- SKILLS REAL ICONS (CRITICAL): Every skill item in `#skills` MUST render its real technology icon using `<img src="{icon_url}" alt="{name}" width="20" height="20" style="width:20px;height:20px;object-fit:contain;flex-shrink:0;" />` from each skill\'s `icon_url` field in the JSON (never use emojis or generic dots instead of the real icon).',
      '- Inside id="contact", include a "Send Message" button/link with `href="#send-message"` so visitors can open the contact form.',
      '- All external links (GitHub, LinkedIn, Resume, Project Live/Code, Paper URL) MUST include `target="_blank" rel="noopener noreferrer"`.',
      '- ANIMATIONS & MICRO-INTERACTIONS (CRITICAL): Include smooth, GPU-accelerated pure CSS3 animations (`transform`, `opacity`) using `@keyframes` and `transition` (NO `<script>`): (1) staggered hero entrance (`animation-fill-mode: both`), (2) subtle continuous ambient motion (e.g. status dot pulse, gentle floating/gradient drift), (3) crisp hover lift/glow on cards, skill pills, nav links, and buttons, and (4) `@media (prefers-reduced-motion: reduce)` fallback.',
      '',
      'Output format:',
      '1. First line MUST be a comment with valid JSON metadata matching your chosen palette and a short `layoutSignature`:',
      '<!--THEME_META {"name":"short-slug","mood":"short description","layoutSignature":"4-8 word layout description","fontStyle":"sans","surface":"#0a0a0a","ink":"#f5f5f5","accent":"#38bdf8","accent2":"#818cf8","accentInk":"#09090b"} -->',
      '2. Immediately followed by a complete `<!DOCTYPE html><html><head><style>...</style></head><body>...</body></html>` document. You may import Google Fonts via `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...">`.',
      '3. NO markdown fences, NO <script> tags, NO inline on* event handlers, NO external CSS frameworks.',
      '4. Include ALL real data below (Profile/Hero, About, Skills, Projects, Publications, Contact email/location, Footer).',
      '',
      `REAL PORTFOLIO DATA (JSON): ${JSON.stringify(portfolioContext)}`,
    ].join('\n');

    const s2Start = Date.now();
    let text: string;
    try {
      const stage2Res = await runLlm({
        provider: routing.ui_gen_provider,
        model: routing.ui_gen_model,
        prompt,
        temperature: 0.85,
        timeoutMs: 90_000,
        maxRetries: 2,
      });
      stage2Log = {
        provider: stage2Res.provider,
        model: stage2Res.model,
        latency_ms: Date.now() - s2Start,
        response: stage2Res.text,
        usage: stage2Res.usage,
      };
      text = stage2Res.text;
    } catch (s2Err) {
      stage2Log = {
        provider: routing.ui_gen_provider,
        model: routing.ui_gen_model,
        latency_ms: Date.now() - s2Start,
        response: '',
        error: s2Err instanceof Error ? s2Err.message : String(s2Err),
      };
      throw s2Err;
    }

    const { theme: nextTheme, layoutSignature, html: safeHtml } = extractHtmlAndTheme(text, current.theme);
    if (safeHtml.length < 300) {
      throw new Error('Generated HTML was unexpectedly short');
    }

    const nextHistory = [
      { name: nextTheme.name, surface: nextTheme.surface, layoutSignature },
      ...recentHistory,
    ].slice(0, 6);

    const activeModelLabel = `${routing.ui_gen_provider}:${routing.ui_gen_model}`;
    const successLog: UiGenerationLog = {
      id: randomUUID(),
      epoch_number: current.epoch_number + 1,
      status: 'success',
      custom_prompt: trimmedPrompt ?? '',
      theme_name: nextTheme.name,
      layout_signature: layoutSignature,
      created_at: new Date().toISOString(),
      total_latency_ms: Date.now() - evolutionStarted,
      stage1: stage1Log,
      stage2: stage2Log,
    };
    const nextLogs = [successLog, ...existingLogs].slice(0, 10);
    const existingTemplates = parseSavedTemplates(rawRow as Record<string, unknown>, current);
    const nextTemplates: SavedTemplate[] = [
      {
        epoch_number: current.epoch_number + 1,
        theme: nextTheme,
        model_name: activeModelLabel,
        generated_html: safeHtml,
      },
      ...existingTemplates.filter((t) => t.epoch_number !== current.epoch_number + 1),
    ].slice(0, 15);

    const effectiveCooldownSec = Math.max(current.cooldown_sec || 0, MIN_AUTO_COOLDOWN_SEC);

    const updates = {
      epoch_number: current.epoch_number + 1,
      theme: nextTheme,
      cooldown_sec: effectiveCooldownSec,
      blueprint: {
        ...existingBp,
        history: nextHistory,
        model_name: activeModelLabel,
        ai_routing: routing,
        generation_logs: nextLogs,
        saved_templates: nextTemplates,
      },
      generated_html: safeHtml,
      refreshed_sections: ['hero', 'projects', 'publications'],
      next_evolution_at: new Date(Date.now() + effectiveCooldownSec * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('portfolio_ui_state')
      .update(updates)
      .eq('slug', 'default')
      .select()
      .single();

    if (error) throw error;
    await triggerWebRevalidation();
    return parseUiStateRow(data as Record<string, unknown>) ?? PortfolioUiStateSchema.parse(data);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[ui-evolution] skipped:', errMsg);
    try {
      const errLog: UiGenerationLog = {
        id: randomUUID(),
        epoch_number: current.epoch_number,
        status: 'error',
        custom_prompt: trimmedPrompt ?? '',
        theme_name: '',
        layout_signature: '',
        created_at: new Date().toISOString(),
        total_latency_ms: Date.now() - evolutionStarted,
        stage1: stage1Log,
        stage2: stage2Log,
        error: errMsg,
      };
      const nextLogs = [errLog, ...existingLogs].slice(0, 10);
      await supabaseAdmin
        .from('portfolio_ui_state')
        .update({
          blueprint: { ...existingBp, generation_logs: nextLogs },
          updated_at: new Date().toISOString(),
        })
        .eq('slug', 'default');
    } catch {
      // avoid masking original generation error
    }
    if (force) throw err;
    return null;
  } finally {
    isMutating = false;
  }
}
