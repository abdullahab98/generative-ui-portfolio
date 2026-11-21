import { z } from 'zod';

export const SkillCategorySchema = z.enum([
  'Frontend',
  'Backend & Architecture',
  'Data & AI',
  'Tools & DevOps',
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const HighlightSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.string().min(1).max(100),
});

export const ProfileUpdateSchema = z.object({
  name: z.string().min(2).max(80),
  brand_name: z.string().min(2).max(40),
  tagline: z.string().min(2).max(120),
  headline: z.string().min(2).max(100),
  subheadline: z.string().min(5).max(300),
  about_title: z.string().min(2).max(120),
  about_subtitle: z.string().min(2).max(240),
  bio: z.string().min(10).max(1000),
  location: z.string().min(2).max(80),
  availability_status: z.string().min(2).max(80),
  email: z.string().email(),
  github_url: z.string().url().or(z.literal('')),
  linkedin_url: z.string().url().or(z.literal('')),
  avatar_url: z.string().url().or(z.literal('')),
  resume_url: z.string().url().or(z.literal('')),
  about_highlights: z.array(HighlightSchema).max(6),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type SiteProfile = ProfileUpdate & { id: string; slug: string; updated_at: string };

export const SkillInputSchema = z.object({
  name: z.string().min(1).max(60),
  category: SkillCategorySchema,
  level: z.string().min(1).max(30).default('Advanced'),
  icon_key: z.string().min(1).max(30).default('code'),
  proficiency: z.number().int().min(0).max(100).default(85),
  sort_order: z.number().int().min(0).default(0),
  is_visible: z.boolean().default(true),
});
export type SkillInput = z.infer<typeof SkillInputSchema>;
export type Skill = SkillInput & { id: string; created_at: string };

export const ProjectInputSchema = z.object({
  title: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  category: z.string().min(2).max(80),
  filter_group: z.string().min(1).max(40).default('Full-Stack'),
  summary: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  tech_stack: z.array(z.string().min(1).max(30)).min(1).max(12),
  live_url: z.string().url().or(z.literal('')).default(''),
  github_url: z.string().url().or(z.literal('')).default(''),
  image_url: z.string().url().or(z.literal('')).default(''),
  is_featured: z.boolean().default(false),
  is_published: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type Project = ProjectInput & { id: string; created_at: string; updated_at: string };

export const PublicationInputSchema = z.object({
  title: z.string().min(3).max(200),
  venue: z.string().min(2).max(140),
  published_year: z.number().int().min(1990).max(2100),
  authors: z.string().min(2).max(300),
  abstract: z.string().max(2500).default(''),
  paper_url: z.string().url().or(z.literal('')).default(''),
  doi: z.string().max(120).default(''),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  is_published: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});
export type PublicationInput = z.infer<typeof PublicationInputSchema>;
export type Publication = PublicationInput & { id: string; created_at: string; updated_at: string };

export const ContactSubmitSchema = z.object({
  sender_name: z.string().min(2).max(80),
  sender_email: z.string().email(),
  subject: z.string().min(2).max(120).default('Portfolio Inquiry'),
  message: z.string().min(10).max(2000),
  turnstile_token: z.string().optional(),
});
export type ContactSubmit = z.infer<typeof ContactSubmitSchema>;

export const MessageStatusSchema = z.enum(['unread', 'read', 'archived']);
export type ContactMessage = {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  status: z.infer<typeof MessageStatusSchema>;
  created_at: string;
};

export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(1500),
      })
    )
    .min(1)
    .max(20),
  turnstile_token: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const AiProviderSchema = z.enum(['gemini', 'crowllm']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const AiRoutingSchema = z.object({
  chat_provider: AiProviderSchema.default('crowllm'),
  chat_model: z.string().min(2).max(120).default('openai/gpt-oss-20b:free'),
  ui_idea_provider: AiProviderSchema.default('gemini'),
  ui_idea_model: z.string().min(2).max(120).default('gemini-3.5-flash-lite'),
  ui_gen_provider: AiProviderSchema.default('gemini'),
  ui_gen_model: z.string().min(2).max(120).default('gemini-3.5-flash-lite'),
});
export type AiRouting = z.infer<typeof AiRoutingSchema>;

export const DEFAULT_AI_ROUTING: AiRouting = {
  chat_provider: 'crowllm',
  chat_model: 'openai/gpt-oss-20b:free',
  ui_idea_provider: 'gemini',
  ui_idea_model: 'gemini-3.5-flash-lite',
  ui_gen_provider: 'gemini',
  ui_gen_model: 'gemini-3.5-flash-lite',
};

export const AiSettingsUpdateSchema = z.object({
  is_enabled: z.boolean(),
  model_name: z.string().min(2).max(60),
  system_prompt: z.string().min(10).max(2000),
  quick_prompts: z.array(z.string().min(2).max(100)).max(6),
});
export type AiSettings = z.infer<typeof AiSettingsUpdateSchema> & { id: string; updated_at: string };

export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB hex color');

export const PortfolioThemeSpecSchema = z.object({
  name: z.string().min(2).max(40),
  mood: z.string().min(4).max(160),
  fontStyle: z.enum(['sans', 'serif', 'mono']).default('sans'),
  surface: HexColorSchema,
  ink: HexColorSchema,
  accent: HexColorSchema,
  accent2: HexColorSchema,
  accentInk: HexColorSchema,
});
export type PortfolioThemeSpec = z.infer<typeof PortfolioThemeSpecSchema>;

export const UiGenerationStageLogSchema = z.object({
  provider: AiProviderSchema,
  model: z.string(),
  latency_ms: z.number().int().nonnegative(),
  response: z.string(),
  usage: z.unknown().optional(),
  error: z.string().optional(),
});
export type UiGenerationStageLog = z.infer<typeof UiGenerationStageLogSchema>;

export const UiGenerationLogSchema = z.object({
  id: z.string(),
  epoch_number: z.number().int().nonnegative(),
  status: z.enum(['success', 'error']),
  custom_prompt: z.string().default(''),
  theme_name: z.string().default(''),
  layout_signature: z.string().default(''),
  created_at: z.string(),
  total_latency_ms: z.number().int().nonnegative(),
  stage1: UiGenerationStageLogSchema.nullable().default(null),
  stage2: UiGenerationStageLogSchema.nullable().default(null),
  error: z.string().optional(),
});
export type UiGenerationLog = z.infer<typeof UiGenerationLogSchema>;

export const UiDisplayModeSchema = z.enum(['single', 'random', 'serial']);
export type UiDisplayMode = z.infer<typeof UiDisplayModeSchema>;

export const UiDisplayConfigSchema = z.object({
  mode: UiDisplayModeSchema.default('random'),
  pinned_epoch: z.number().int().positive().nullable().default(null),
  selected_epochs: z.array(z.number().int().positive()).default([]),
});
export type UiDisplayConfig = z.infer<typeof UiDisplayConfigSchema>;

export const DEFAULT_UI_DISPLAY_CONFIG: UiDisplayConfig = {
  mode: 'random',
  pinned_epoch: null,
  selected_epochs: [],
};

export const SavedUiTemplateSummarySchema = z.object({
  epoch_number: z.number().int().positive(),
  theme: PortfolioThemeSpecSchema,
  model_name: z.string().optional(),
  html_length: z.number().int().nonnegative(),
});
export type SavedUiTemplateSummary = z.infer<typeof SavedUiTemplateSummarySchema>;

export const PortfolioUiStateSchema = z.object({
  epoch_number: z.number().int().positive(),
  theme: PortfolioThemeSpecSchema,
  model_name: z.string().optional(),
  show_ai_bar: z.boolean().optional(),
  generated_html: z.string().nullable().optional(),
  auto_evolve: z.boolean(),
  cooldown_sec: z.number().int().min(10).max(86400),
  next_evolution_at: z.string(),
});
export type PortfolioUiState = z.infer<typeof PortfolioUiStateSchema>;

export type PortfolioPayload = {
  profile: SiteProfile;
  skills: Skill[];
  projects: Project[];
  publications: Publication[];
  ai: {
    is_enabled: boolean;
    quick_prompts: string[];
  };
  uiState?: PortfolioUiState;
};

const SKILL_ICON_RULES: Array<[RegExp, string]> = [
  [/react/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg'],
  [/next/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg'],
  [/tailwind/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg'],
  [/node|express/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg'],
  [/python|fastapi/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg'],
  [/java\b|spring/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg'],
  [/supabase/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg'],
  [/mongo/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg'],
  [/postgres/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg'],
  [/opencv/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opencv/opencv-original.svg'],
  [/cloudflare/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cloudflare/cloudflare-original.svg'],
  [/gemini|llm|sparkles/i, 'https://cdn.simpleicons.org/googlegemini/4285f4'],
  [/microservice|jwt|shield/i, 'https://cdn.simpleicons.org/jsonwebtokens/d63aff'],
  [/typescript/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg'],
  [/javascript/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg'],
  [/docker/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/docker/docker-original.svg'],
  [/flutter/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/flutter/flutter-original.svg'],
  [/git\b/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg'],
  [/database/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg'],
  [/cloud/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cloudflare/cloudflare-original.svg'],
  [/cpu/i, 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/opencv/opencv-original.svg'],
];

const DEFAULT_SKILL_ICON =
  'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/devicon/devicon-original.svg';

/** Resolve a real technology/brand SVG icon URL from a skill name and icon_key. */
export function resolveSkillIconUrl(name: string, iconKey?: string): string {
  const haystack = `${name} ${iconKey ?? ''}`;
  for (const [pattern, url] of SKILL_ICON_RULES) {
    if (pattern.test(haystack)) return url;
  }
  return DEFAULT_SKILL_ICON;
}
