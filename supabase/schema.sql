-- ============================================================
-- Portfolio Rebuild: Supabase PostgreSQL Schema, RLS & Seed
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. Site Profile (single-row configuration for Hero, About, Navbar, Footer)
create table if not exists public.site_profile (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default 'main',
  name text not null,
  brand_name text not null default 'Md.Abdullah',
  tagline text not null,
  headline text not null,
  subheadline text not null,
  about_title text not null,
  about_subtitle text not null,
  bio text not null,
  location text not null,
  availability_status text not null default 'Open to Opportunities',
  email text not null,
  github_url text not null default '',
  linkedin_url text not null default '',
  avatar_url text not null default '',
  resume_url text not null default '',
  about_highlights jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Skills
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Frontend', 'Backend & Architecture', 'Data & AI', 'Tools & DevOps')),
  level text not null default 'Advanced',
  icon_key text not null default 'code',
  proficiency int not null default 85 check (proficiency >= 0 and proficiency <= 100),
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  category text not null,
  filter_group text not null default 'All',
  summary text not null,
  description text not null,
  tech_stack text[] not null default '{}',
  live_url text not null default '',
  github_url text not null default '',
  image_url text not null default '',
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Publications (Research Papers, Articles, Conference/Journal Works)
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text not null,
  published_year int not null check (published_year >= 1990 and published_year <= 2100),
  authors text not null,
  abstract text not null default '',
  paper_url text not null default '',
  doi text not null default '',
  tags text[] not null default '{}',
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Contact Messages (Inbox)
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null,
  sender_email text not null,
  subject text not null default 'Portfolio Inquiry',
  message text not null,
  ip_hash text not null default '',
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_at timestamptz not null default now()
);

-- 5. AI Chatbot Settings (single-row)
create table if not exists public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null default 'default',
  is_enabled boolean not null default true,
  model_name text not null default 'gemini-3.5-flash-lite',
  system_prompt text not null,
  quick_prompts text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 6. Admin Whitelist
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- 7. Self-Evolving UI State (100% Theme Epochs + Section Variants)
create table if not exists public.portfolio_ui_state (
  slug text primary key default 'default',
  epoch_number int not null default 1,
  design_pattern text not null default 'bento-dashboard' check (design_pattern in ('editorial-magazine', 'bento-dashboard', 'sidebar-portfolio', 'terminal-os', 'brutalist-showcase')),
  theme jsonb not null,
  hero_variant text not null default 'centered' check (hero_variant in ('centered', 'split', 'terminal')),
  projects_variant text not null default 'grid-3col' check (projects_variant in ('grid-3col', 'bento', 'list')),
  publications_variant text not null default 'cards' check (publications_variant in ('cards', 'compact-list')),
  refreshed_sections text[] not null default '{}',
  auto_evolve boolean not null default true,
  cooldown_sec int not null default 1200,
  next_evolution_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe migration if table already exists from earlier run:
alter table public.portfolio_ui_state
  add column if not exists design_pattern text not null default 'bento-dashboard';

alter table public.portfolio_ui_state
  add column if not exists blueprint jsonb;

alter table public.portfolio_ui_state
  add column if not exists generated_html text;

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table public.site_profile enable row level security;
alter table public.skills enable row level security;
alter table public.projects enable row level security;
alter table public.publications enable row level security;
alter table public.contact_messages enable row level security;
alter table public.ai_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.portfolio_ui_state enable row level security;

-- Public read access ONLY for published portfolio content
create policy "Public read site_profile"
  on public.site_profile for select using (true);

create policy "Public read visible skills"
  on public.skills for select using (is_visible = true);

create policy "Public read published projects"
  on public.projects for select using (is_published = true);

create policy "Public read published publications"
  on public.publications for select using (is_published = true);

-- Helper: check if authenticated user is in admin_users
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- Admin full access policies
create policy "Admin all site_profile" on public.site_profile for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin all skills" on public.skills for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin all projects" on public.projects for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin all publications" on public.publications for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin all contact_messages" on public.contact_messages for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin all ai_settings" on public.ai_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "Admin read self" on public.admin_users for select using (auth.uid() = user_id);
create policy "Public read portfolio_ui_state" on public.portfolio_ui_state for select using (true);
create policy "Admin all portfolio_ui_state" on public.portfolio_ui_state for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Storage Bucket for Project Images & Resume PDF
-- ============================================================
insert into storage.buckets (id, name, public)
values ('portfolio-assets', 'portfolio-assets', true)
on conflict (id) do nothing;

create policy "Public read portfolio-assets"
  on storage.objects for select using (bucket_id = 'portfolio-assets');

create policy "Admin write portfolio-assets"
  on storage.objects for insert with check (bucket_id = 'portfolio-assets' and public.is_admin());

create policy "Admin delete portfolio-assets"
  on storage.objects for delete using (bucket_id = 'portfolio-assets' and public.is_admin());

-- ============================================================
-- Initial Seed Data (from abdullahab98/portfolio)
-- ============================================================
insert into public.site_profile (
  slug, name, brand_name, tagline, headline, subheadline,
  about_title, about_subtitle, bio, location, availability_status, email,
  github_url, linkedin_url, about_highlights
) values (
  'main',
  'Md. Abdullah',
  'Md.Abdullah',
  'Full-Stack Software Engineer • UMS Developer',
  'Md. Abdullah',
  'Computer Science student specializing in scalable web/mobile apps, AI integration, and microservices architecture.',
  'Architecting Resilient Systems & Practical Code',
  'A look into my academic journey, real-world development at Southeast University, and core engineering principles.',
  'I build full-stack web applications, AI-powered platforms, and resilient backend architectures with TypeScript, Next.js, Express, Python, and Java.',
  'Dhaka, Bangladesh',
  'Available for Software Engineering Roles',
  'contact@mdabdullah.dev',
  'https://github.com/abdullahab98',
  'https://linkedin.com/in/abdullahab98',
  '[
    {"label": "Education", "value": "B.Sc. in CSE, Southeast University"},
    {"label": "Role", "value": "UMS Developer & Full-Stack Engineer"},
    {"label": "Focus", "value": "Microservices, AI Systems & Cloud"}
  ]'::jsonb
) on conflict (slug) do nothing;

insert into public.skills (name, category, level, icon_key, proficiency, sort_order) values
  ('React', 'Frontend', 'Advanced', 'react', 92, 1),
  ('Next.js', 'Frontend', 'Advanced', 'nextjs', 90, 2),
  ('Tailwind CSS', 'Frontend', 'Advanced', 'tailwind', 94, 3),
  ('React Native', 'Frontend', 'Proficient', 'mobile', 80, 4),
  ('Node.js & Express', 'Backend & Architecture', 'Advanced', 'nodejs', 90, 5),
  ('Python & FastAPI', 'Backend & Architecture', 'Advanced', 'python', 88, 6),
  ('Java (Spring Boot)', 'Backend & Architecture', 'Advanced', 'java', 85, 7),
  ('Microservices & JWT', 'Backend & Architecture', 'Proficient', 'shield', 85, 8),
  ('Supabase & PostgreSQL', 'Data & AI', 'Advanced', 'database', 88, 9),
  ('MongoDB', 'Data & AI', 'Advanced', 'database', 86, 10),
  ('Gemini & Groq LLMs', 'Data & AI', 'Advanced', 'sparkles', 88, 11),
  ('OpenCV', 'Data & AI', 'Proficient', 'cpu', 78, 12),
  ('Cloudflare & DevOps', 'Tools & DevOps', 'Proficient', 'cloud', 82, 13)
on conflict do nothing;

insert into public.projects (title, slug, category, filter_group, summary, description, tech_stack, github_url, is_featured, sort_order) values
  (
    'PulseHR-AI',
    'pulsehr-ai',
    'Enterprise & AI Systems',
    'AI & Systems',
    'AI-assisted HR & workforce management platform.',
    'Full-stack HR automation platform combining intelligent candidate screening, attendance workflows, and analytics.',
    array['Next.js', 'TypeScript', 'Node.js', 'AI'],
    'https://github.com/abdullahab98',
    true,
    1
  ),
  (
    'Medicalx',
    'medicalx',
    'Healthcare & AI Systems',
    'AI & Systems',
    'Smart healthcare platform with AI triage and patient records.',
    'Connected healthcare management system designed for fast patient workflows, diagnostics support, and secure medical records.',
    array['React', 'FastAPI', 'Python', 'MongoDB'],
    'https://github.com/abdullahab98',
    true,
    2
  ),
  (
    'Smart Parking Management System',
    'smart-parking-management',
    'Full-Stack & Cloud Architecture',
    'Full-Stack',
    'Real-time parking slot allocation and cloud management system.',
    'Scalable parking management backend and dashboard supporting live slot tracking, billing, and role-based access.',
    array['Spring Boot', 'React', 'PostgreSQL', 'JWT'],
    'https://github.com/abdullahab98',
    true,
    3
  ),
  (
    'Automated ANPR Parking System',
    'anpr-parking-system',
    'Computer Vision & IoT',
    'AI & Systems',
    'Automatic Number Plate Recognition for automated gate entry.',
    'Computer vision pipeline using OpenCV to detect and read vehicle license plates for contactless parking automation.',
    array['Python', 'OpenCV', 'FastAPI'],
    'https://github.com/abdullahab98',
    false,
    4
  ),
  (
    'BD Railway Ticket Quick Booker',
    'bd-railway-quick-booker',
    'Browser Extensions & Automation',
    'Tools',
    'Browser extension for streamlined railway ticket booking workflows.',
    'Productivity browser extension engineered to speed up form filling and route selection during peak ticket windows.',
    array['TypeScript', 'Chrome Extension', 'DOM'],
    'https://github.com/abdullahab98',
    false,
    5
  )
on conflict (slug) do nothing;

insert into public.publications (
  title, venue, published_year, authors, abstract, paper_url, doi, tags, is_published, sort_order
)
select
  'BDryFish: An Image Dataset for Dried Fish Classification in Bangladesh',
  'Science Data Bank (ScienceDB) • Open Access Dataset (V5, CC BY 4.0)',
  2026,
  'Tanvir Anjum Apurbo, Kh Faysal Ahammed, Hafizur Rahman, Md. Abdullah',
  'BDryFish is an image dataset of dried fish (shutki) as it is sold in Bangladesh. It contains 5,778 smartphone photographs of 22 market trade categories, taken on two field days, 14 and 21 May 2025, at two wholesale markets in Dhaka, Bangladesh, namely Karwan Bazar (23.7517 N, 90.3943 E) and Rayerbazar Shutki Arot in Mohammadpur (23.7456 N, 90.3587 E). Each category was photographed in two presentations: Single images (2,981) show isolated specimens laid on a plain sheet, and Bulk images (2,797) show the dense heaps in which the product is displayed for sale (210–345 images per category). Photographs were captured with Apple iPhone 15 (4,533), Apple iPhone 12 (241), and Samsung Galaxy F22 (1,003), curated from ~7,000 shots with SHA-256 deduplication. The 18.38 GB record includes BDryFish-v4-raw.zip (17.51 GB), BDryFish-v4-resized640.zip (874.95 MB), and BDryFish-v5-metadata.zip (1.14 MB) with 28-column images.csv, classes.csv, SHA-256 manifests, and session-aware train/val/test splits.',
  'https://doi.org/10.57760/sciencedb.25907',
  '10.57760/sciencedb.25907',
  array['Computer Vision', 'Image Classification', 'Shutki / Dried Fish', 'Session-Aware Split', 'SHA-256 Verified', 'CC BY 4.0'],
  true,
  1
where not exists (
  select 1 from public.publications where doi = '10.57760/sciencedb.25907'
);

insert into public.ai_settings (slug, is_enabled, model_name, system_prompt, quick_prompts) values (
  'default',
  true,
  'gemini-3.5-flash-lite',
  'You are the portfolio AI assistant for Md. Abdullah, a Full-Stack Software Engineer. Answer questions concisely using only the provided portfolio data (profile, skills, and projects). Never invent fake experience or links.',
  array['Tell me about Abdullah''s top projects', 'What is his backend tech stack?', 'How can I contact him?']
) on conflict (slug) do nothing;

insert into public.portfolio_ui_state (
  slug, epoch_number, theme, hero_variant, projects_variant, publications_variant, refreshed_sections, auto_evolve, cooldown_sec
) values (
  'default',
  1,
  '{
    "name": "cyber-slate",
    "mood": "Crisp dark cyber slate with cyan-indigo accents",
    "fontStyle": "sans",
    "surface": "#07090e",
    "ink": "#f1f5f9",
    "accent": "#06b6d4",
    "accent2": "#6366f1",
    "accentInk": "#020617"
  }'::jsonb,
  'centered',
  'grid-3col',
  'cards',
  '{}',
  true,
  60
) on conflict (slug) do nothing;
