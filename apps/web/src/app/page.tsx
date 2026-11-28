import type { CSSProperties } from 'react';
import { fetchPortfolio } from '@/lib/api';
import { preparePortfolioIframeHtml } from '@/lib/iframe-html';
import { PortfolioShell } from '@/components/portfolio/PortfolioShell';

export const instant = false;

export default async function HomePage() {
  const data = await fetchPortfolio();
  const { profile, skills, ai, uiState } = data;
  const theme = uiState?.theme;
  const styledHtml = preparePortfolioIframeHtml(uiState?.generated_html, theme);
  const showAiBar = uiState?.show_ai_bar ?? true;
  const epochNumber = uiState?.epoch_number ?? 1;

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-slate-100">
      {/* Slim Top Bar (controlled from Admin UI Studio) */}
      {showAiBar && (
        <header
          style={
            theme
              ? ({ backgroundColor: theme.accent, color: theme.accentInk } as CSSProperties)
              : undefined
          }
          className="px-4 py-1.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-white/10"
        >
          <span className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Logo" width={16} height={16} className="w-4 h-4 rounded" />
            <span>
              AI-Generated Portfolio · Gen #{epochNumber}
              {theme ? ` · ${theme.name}` : ''}
              {` · ${uiState?.model_name ?? 'gemini-3.5-flash-lite'}`}
            </span>
          </span>
        </header>
      )}

      {/* 100% AI-Generated HTML & CSS View (rendered on server to avoid duplicate RSC prop serialization) */}
      {styledHtml ? (
        <iframe
          id="portfolio-frame"
          title="AI Generated Portfolio"
          srcDoc={styledHtml}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          className={`w-full flex-1 border-0 ${showAiBar ? 'min-h-[calc(100vh-32px)]' : 'min-h-screen'}`}
        />
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <h1 className="text-3xl font-bold">{profile.headline}</h1>
          <p className="text-sm text-slate-400 max-w-md">{profile.subheadline}</p>
          <p className="text-xs font-mono text-cyan-400">
            No AI HTML generated yet. Open /admin → ui tab and click &quot;Randomly Evolve&quot;.
          </p>
        </main>
      )}

      <PortfolioShell
        brandName={profile.brand_name}
        email={profile.email}
        location={profile.location}
        skills={skills.map((s) => ({ name: s.name, icon_key: s.icon_key }))}
        ai={ai}
        theme={theme}
        epochNumber={epochNumber}
        hasHtml={Boolean(styledHtml)}
      />
    </div>
  );
}
