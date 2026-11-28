export interface ReleaseEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const APP_CHANGELOG: ReleaseEntry[] = [
  {
    version: '0.2.2',
    date: '2026-11-28',
    title: 'Blueprint-to-Table Template Migration & Cleanup',
    changes: [
      'Added SQL migration to transfer all legacy blueprint.saved_templates and active generated_html into separate rows in public.portfolio_ui_templates.',
      'Automatically strips legacy saved_templates from portfolio_ui_state.blueprint after migration to keep the state row lightweight.',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-11-28',
    title: 'Admin Release Changelog & Version Tracker',
    changes: [
      'Made the Admin navbar version badge clickable to inspect full release history.',
      'Recorded structured per-version release notes in apps/web/src/lib/changelog.ts.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-28',
    title: 'Performance, Per-Row UI Storage & Navbar Version Badge',
    changes: [
      'Public site speed: added Next.js 60s revalidation cache + 4.5s API timeout, server-rendered iframe to eliminate duplicate HTML hydration payload, font display=swap, CDN preconnects, lazy image loading, and instant DOMContentLoaded iframe attachment.',
      'Admin panel speed: added 60s in-memory verified-JWT cache in requireAdmin, removed redundant client getSession() round-trips, fixed AdminProvider effect re-runs, and narrowed Supabase select projections.',
      'Per-row UI storage: added public.portfolio_ui_templates table so each generated UI is stored in its own row instead of a single JSONB array.',
      'Admin navbar: added live app version & build commit SHA badge.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-27',
    title: 'Initial Generative UI Portfolio',
    changes: [
      '2-stage AI UI evolution (Gemini & CrowLLM routing) with sandboxed iframe rendering.',
      'Admin Studio for Profile, Skills, Projects, Publications, Messages, AI Control Center, and UI Display/Rotation modes.',
      'Cloudflare Turnstile protection, Resend contact notifications, and floating AI ChatWidget.',
    ],
  },
];
