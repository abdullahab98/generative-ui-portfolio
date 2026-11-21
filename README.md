# Portfolio Rebuild (Next.js + Express + Supabase + Cloudflare)

Full-stack portfolio monorepo with an Admin Dashboard, Research Publications section, AI Assistant, and Cloudflare protection.

## Workspaces
- `packages/shared` — Shared Zod schemas and TypeScript contracts.
- `apps/api` — Express.js + TypeScript REST API (Supabase Auth JWT guard, Turnstile verification, Resend email, Gemini AI proxy, Next.js cache revalidation).
- `apps/web` — Next.js 16 App Router frontend + `/admin` dashboard.
- `supabase/schema.sql` — PostgreSQL tables, RLS policies, Storage bucket (`portfolio-assets`), and initial seed data.

## Quick Start
1. Run `supabase/schema.sql` in your Supabase SQL Editor.
2. Create an admin user in **Supabase Auth → Users**, then insert their `id` and `email` into `public.admin_users`.
3. Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`.
4. Install and build:
   ```bash
   npm install
   npm --workspace=@portfolio/shared run build
   ```
5. Run both servers:
   ```bash
   npm run dev:api
   npm run dev:web
   ```

## Cloudflare Production Setup
- **DNS:** Proxy `yourdomain.com` → Next.js (`apps/web`) and `api.yourdomain.com` → Express (`apps/api`) with SSL mode **Full (Strict)**.
- **Turnstile:** Create a Turnstile widget in Cloudflare and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`apps/web`) + `TURNSTILE_SECRET_KEY` (`apps/api`).
- **Cache:** `GET /api/v1/portfolio` sets `s-maxage=60, stale-while-revalidate=300` and Admin updates automatically call `/api/revalidate`.
