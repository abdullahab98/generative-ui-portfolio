'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PortfolioPayload, PortfolioThemeSpec } from '@portfolio/shared';
import { adminFetch, fetchPortfolio } from '@/lib/api';
import { preparePortfolioIframeHtml } from '@/lib/iframe-html';
import { useAdmin } from '@/components/admin/AdminProvider';
import { PortfolioShell } from '@/components/portfolio/PortfolioShell';
import { LoadingPanel } from '@/components/admin/AdminUi';

interface SavedUiTemplateDetail {
  epoch_number: number;
  theme: PortfolioThemeSpec;
  model_name?: string;
  generated_html: string;
}

function AdminUiPreviewInner() {
  const searchParams = useSearchParams();
  const epochParam = searchParams.get('epoch');
  const epochNumber = Number(epochParam);
  const { token, checkingAuth } = useAdmin();

  const [payload, setPayload] = useState<PortfolioPayload | null>(null);
  const [error, setError] = useState('');
  const invalidEpoch = !Number.isInteger(epochNumber) || epochNumber <= 0;

  useEffect(() => {
    if (checkingAuth || !token || invalidEpoch) return;

    let active = true;
    Promise.all([
      adminFetch<SavedUiTemplateDetail>(`/ui-state/templates/${epochNumber}`, token),
      fetchPortfolio(),
    ])
      .then(([template, portfolio]) => {
        if (!active) return;
        setError('');
        setPayload({
          ...portfolio,
          uiState: {
            ...portfolio.uiState,
            auto_evolve: portfolio.uiState?.auto_evolve ?? false,
            cooldown_sec: portfolio.uiState?.cooldown_sec ?? 1200,
            next_evolution_at: portfolio.uiState?.next_evolution_at ?? new Date().toISOString(),
            epoch_number: template.epoch_number,
            theme: template.theme,
            model_name: template.model_name,
            generated_html: template.generated_html,
            show_ai_bar: false,
          },
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load UI preview');
      });

    return () => {
      active = false;
    };
  }, [checkingAuth, token, epochNumber, invalidEpoch]);

  if (checkingAuth || (!invalidEpoch && token && !payload && !error)) {
    return (
      <div className="min-h-screen bg-[#06080f] p-6">
        <LoadingPanel label={`Loading Gen #${epochParam || '?'} preview...`} />
      </div>
    );
  }

  const displayError = invalidEpoch ? 'Invalid or missing ?epoch= parameter.' : error;

  if (displayError || !payload) {
    return (
      <div className="min-h-screen bg-[#06080f] text-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-lg font-semibold text-white">Preview Unavailable</div>
        <p className="text-sm text-rose-300 max-w-md">{displayError || 'Could not load template.'}</p>
        <Link
          href="/admin/ui"
          className="px-4 py-2 rounded-xl border border-white/15 bg-white/[0.06] text-xs font-mono text-cyan-300 hover:bg-white/[0.1]"
        >
          Back to Generative UI Studio
        </Link>
      </div>
    );
  }

  const styledHtml = preparePortfolioIframeHtml(payload.uiState?.generated_html, payload.uiState?.theme);

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-slate-100">
      {styledHtml ? (
        <iframe
          id="portfolio-frame"
          title="AI Generated Portfolio Preview"
          srcDoc={styledHtml}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          className="w-full flex-1 border-0 min-h-screen"
        />
      ) : null}
      <PortfolioShell
        brandName={payload.profile.brand_name}
        email={payload.profile.email}
        location={payload.profile.location}
        skills={payload.skills.map((s) => ({ name: s.name, icon_key: s.icon_key }))}
        ai={payload.ai}
        theme={payload.uiState?.theme}
        epochNumber={payload.uiState?.epoch_number ?? epochNumber}
        hasHtml={Boolean(styledHtml)}
      />
    </div>
  );
}

export default function AdminUiPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#06080f] p-6">
          <LoadingPanel label="Loading UI preview..." />
        </div>
      }
    >
      <AdminUiPreviewInner />
    </Suspense>
  );
}
