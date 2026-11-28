'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Shuffle,
  ExternalLink,
  Palette,
  RefreshCw,
  FileCode2,
  Lightbulb,
  Copy,
  Check,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pin,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Save,
  Layers,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  Code2,
  X,
} from 'lucide-react';
import {
  DEFAULT_UI_DISPLAY_CONFIG,
  type PortfolioThemeSpec,
  type PortfolioUiState,
  type SavedUiTemplateSummary,
  type UiDisplayConfig,
  type UiDisplayMode,
  type UiGenerationLog,
} from '@portfolio/shared';
import { adminFetch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  AlertBanner,
  Card,
  EmptyState,
  LoadingPanel,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputClass,
} from '@/components/admin/AdminUi';

const PROMPT_IDEAS = [
  'Warm Japanese minimalist paper editorial with forest green accents and serif typography',
  'Swiss brutalist grid with high-contrast monochrome ivory, crimson accents, and bold grotesk type',
  'Deep emerald botanical studio with gold hairline borders and floating bottom dock navigation',
  'Retro-futuristic midnight blueprint terminal with crisp cyan grid lines and monospace metrics',
];

interface SavedUiTemplateDetail {
  epoch_number: number;
  theme: PortfolioThemeSpec;
  model_name?: string;
  generated_html: string;
}

export default function AdminUiStudioPage() {
  const { token, toast } = useAdmin();
  const [uiState, setUiState] = useState<PortfolioUiState | null>(null);
  const [templates, setTemplates] = useState<SavedUiTemplateSummary[]>([]);
  const [displayConfig, setDisplayConfig] = useState<UiDisplayConfig>(DEFAULT_UI_DISPLAY_CONFIG);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState<number | null>(null);
  const [previewDetail, setPreviewDetail] = useState<SavedUiTemplateDetail | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewTab, setPreviewTab] = useState<'render' | 'html'>('render');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [logs, setLogs] = useState<UiGenerationLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<'stage1' | 'stage2'>('stage1');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [designPrompt, setDesignPrompt] = useState('');
  const [evolving, setEvolving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const reloadLogs = useCallback(async () => {
    if (!token) return;
    setRefreshingLogs(true);
    try {
      const [nextLogs, tplData] = await Promise.all([
        adminFetch<UiGenerationLog[]>('/ui-state/logs', token),
        adminFetch<{ templates: SavedUiTemplateSummary[]; displayConfig: UiDisplayConfig }>('/ui-state/templates', token),
      ]);
      setLogs(nextLogs);
      setTemplates(tplData.templates);
      setDisplayConfig(tplData.displayConfig);
      setSelectedLogId((prev) => (prev && nextLogs.some((l) => l.id === prev) ? prev : nextLogs[0]?.id ?? null));
    } catch {
      // keep existing logs if refresh fails
    } finally {
      setRefreshingLogs(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([
      adminFetch<PortfolioUiState | null>('/ui-state', token),
      adminFetch<UiGenerationLog[]>('/ui-state/logs', token),
      adminFetch<{ templates: SavedUiTemplateSummary[]; displayConfig: UiDisplayConfig }>('/ui-state/templates', token),
    ])
      .then(([uiData, logData, tplData]) => {
        if (!active) return;
        setUiState(uiData);
        setLogs(logData);
        setTemplates(tplData.templates);
        setDisplayConfig(tplData.displayConfig);
        setSelectedLogId(logData[0]?.id ?? null);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load UI state');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function saveDisplayConfig(nextConfig: UiDisplayConfig, customMessage?: string) {
    if (!token) return;
    setSavingDisplay(true);
    setError('');
    try {
      const res = await adminFetch<{ templates: SavedUiTemplateSummary[]; displayConfig: UiDisplayConfig }>(
        '/ui-state/display',
        token,
        {
          method: 'PUT',
          body: JSON.stringify(nextConfig),
        },
      );
      setTemplates(res.templates);
      setDisplayConfig(res.displayConfig);
      const updatedUi = await adminFetch<PortfolioUiState | null>('/ui-state', token);
      if (updatedUi) setUiState(updatedUi);
      const msg = customMessage || `Display mode saved (${res.displayConfig.mode}).`;
      setNotice(msg);
      toast.success(msg, 'Display Updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save display config';
      setError(msg);
      toast.error(msg, 'Update Failed');
    } finally {
      setSavingDisplay(false);
    }
  }

  async function openPreview(epochNumber: number) {
    if (!token) return;
    setPreviewEpoch(epochNumber);
    setPreviewDetail(null);
    setPreviewError('');
    setPreviewTab('render');
    setLoadingPreview(true);
    try {
      const detail = await adminFetch<SavedUiTemplateDetail>(`/ui-state/templates/${epochNumber}`, token);
      setPreviewDetail(detail);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load template HTML');
    } finally {
      setLoadingPreview(false);
    }
  }

  function downloadTemplateHtml(detail: SavedUiTemplateDetail) {
    const blob = new Blob([detail.generated_html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-gen-${detail.epoch_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteTemplate(epochNumber: number) {
    if (!token) return;
    setError('');
    try {
      const res = await adminFetch<{ templates: SavedUiTemplateSummary[]; displayConfig: UiDisplayConfig }>(
        `/ui-state/templates/${epochNumber}`,
        token,
        { method: 'DELETE' },
      );
      setTemplates(res.templates);
      setDisplayConfig(res.displayConfig);
      toast.success(`Removed Gen #${epochNumber} from saved templates.`, 'Template Deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete template';
      setError(msg);
      toast.error(msg);
    }
  }

  function toggleSelectedEpoch(epochNumber: number) {
    setDisplayConfig((prev) => {
      const exists = prev.selected_epochs.includes(epochNumber);
      return {
        ...prev,
        selected_epochs: exists
          ? prev.selected_epochs.filter((ep) => ep !== epochNumber)
          : [...prev.selected_epochs, epochNumber],
      };
    });
  }

  function moveSelectedEpoch(epochNumber: number, dir: -1 | 1) {
    setDisplayConfig((prev) => {
      const list = [...prev.selected_epochs];
      const idx = list.indexOf(epochNumber);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= list.length) return prev;
      [list[idx], list[target]] = [list[target], list[idx]];
      return { ...prev, selected_epochs: list };
    });
  }

  async function triggerEvolve(prompt?: string) {
    if (!token) return;
    setEvolving(true);
    setNotice('');
    setError('');
    try {
      const updated = await adminFetch<PortfolioUiState | null>('/ui-state/evolve', token, {
        method: 'POST',
        body: JSON.stringify(prompt ? { prompt } : {}),
      });
      if (updated) {
        setUiState(updated);
        const msg = prompt
          ? `Generated Gen #${updated.epoch_number} (${updated.theme.name}) from your prompt!`
          : `Generated random unique design Gen #${updated.epoch_number} (${updated.theme.name})!`;
        setNotice(msg);
        toast.success(msg, 'UI Generated');
      } else {
        const msg = 'Generation skipped (check API key configuration in AI Control Center or apps/api/.env).';
        setError(msg);
        toast.error(msg, 'Skipped');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
      toast.error(msg, 'Generation Failed');
    } finally {
      setEvolving(false);
      await reloadLogs();
    }
  }

  async function clearLogs() {
    if (!token) return;
    setError('');
    try {
      await adminFetch('/ui-state/logs', token, { method: 'DELETE' });
      setLogs([]);
      setSelectedLogId(null);
      setNotice('Cleared saved Stage 1 & Stage 2 API response logs.');
      toast.success('Cleared saved Stage 1 & Stage 2 API response logs.', 'Logs Cleared');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear logs';
      setError(msg);
      toast.error(msg);
    }
  }

  async function copyResponse(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      toast.info('Copied response to clipboard.', 'Copied');
      setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      toast.error('Clipboard permission unavailable.');
    }
  }

  async function updateUiSetting(
    patch: Partial<Pick<PortfolioUiState, 'auto_evolve' | 'cooldown_sec' | 'show_ai_bar'>>,
  ) {
    if (!token) return;
    setError('');
    try {
      const updated = await adminFetch<PortfolioUiState>('/ui-state', token, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUiState(updated);
      setNotice('UI setting updated.');
      toast.success('UI setting updated.', 'Settings Saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setError(msg);
      toast.error(msg);
    }
  }

  if (loading || !uiState) return <LoadingPanel label="Loading Generative UI studio..." />;

  const selectedLog = logs.find((l) => l.id === selectedLogId) ?? logs[0] ?? null;
  const activeStage = selectedLog ? (activeStageTab === 'stage1' ? selectedLog.stage1 : selectedLog.stage2) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generative UI Studio"
        description="Direct your 2-stage AI art director to craft a custom portfolio layout and inspect saved Stage 1 & Stage 2 API responses."
        action={
          <Link href="/" target="_blank" rel="noopener noreferrer" className={btnSecondary}>
            Preview Live UI <ExternalLink className="w-4 h-4" />
          </Link>
        }
      />

      <AlertBanner
        notice={notice}
        error={error}
        onClear={() => {
          setNotice('');
          setError('');
        }}
      />

      {/* Active Generation Card */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-300">
                Generation #{uiState.epoch_number}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-300">
                {uiState.model_name ?? 'gemini-3.5-flash-lite'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
                {uiState.generated_html ? `${uiState.generated_html.length.toLocaleString()} bytes` : 'No HTML'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-cyan-400" /> {uiState.theme.name}
            </h2>
            <p className="text-sm text-slate-400">{uiState.theme.mood}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Surface', hex: uiState.theme.surface },
            { label: 'Ink', hex: uiState.theme.ink },
            { label: 'Accent', hex: uiState.theme.accent },
            { label: 'Accent 2', hex: uiState.theme.accent2 },
            { label: 'Accent Ink', hex: uiState.theme.accentInk },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-white/10 bg-[#070a12] p-2.5">
              <div className="h-8 rounded-lg border border-white/10" style={{ backgroundColor: c.hex }} />
              <div className="text-[11px] font-mono text-slate-400 mt-2">{c.label}</div>
              <div className="text-xs font-mono text-slate-200">{c.hex}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Live UI Display & Rotation Control */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Visitor UI Display &amp; Rotation Control
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-cyan-400/15 text-cyan-300 border border-cyan-400/25">
                {templates.length} saved
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose whether visitors see 1 pinned UI, a non-repeating random cycle, or a serial sequence of selected UIs.
            </p>
          </div>
          <button
            type="button"
            disabled={savingDisplay}
            onClick={() => void saveDisplayConfig(displayConfig)}
            className={btnPrimary}
          >
            <Save className="w-4 h-4" />
            {savingDisplay ? 'Saving...' : 'Save Display Control'}
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid sm:grid-cols-3 gap-3">
          {(
            [
              {
                mode: 'single' as UiDisplayMode,
                title: 'Single UI (Live Pin)',
                desc: 'Lock 1 chosen UI so every visitor sees the exact same design.',
                icon: Pin,
              },
              {
                mode: 'random' as UiDisplayMode,
                title: 'Random (No-Repeat)',
                desc: 'Rotate randomly through selected UIs without repeating.',
                icon: Shuffle,
              },
              {
                mode: 'serial' as UiDisplayMode,
                title: 'Serial (In Order)',
                desc: 'Show selected UIs one-by-one in your exact ordered sequence.',
                icon: ListOrdered,
              },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = displayConfig.mode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setDisplayConfig((prev) => ({ ...prev, mode: opt.mode }))}
                className={`text-left rounded-xl border p-4 transition cursor-pointer space-y-1.5 ${
                  active
                    ? 'border-cyan-400/60 bg-cyan-400/15 text-white'
                    : 'border-white/10 bg-[#070a12] text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className={`w-4 h-4 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
                  <span>{opt.title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Multi-select / Serial Helper Bar */}
        {displayConfig.mode !== 'single' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#070a12] px-4 py-3 text-xs">
            <div className="text-slate-300 font-mono">
              {displayConfig.selected_epochs.length > 0 ? (
                <>
                  Active {displayConfig.mode} queue ({displayConfig.selected_epochs.length}):{' '}
                  <span className="text-cyan-300">
                    {displayConfig.selected_epochs.map((ep) => `#${ep}`).join(' → ')}
                  </span>
                </>
              ) : (
                <span className="text-slate-400">
                  No specific UIs selected — rotating across ALL {templates.length} saved templates.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDisplayConfig((prev) => ({
                    ...prev,
                    selected_epochs: templates.map((t) => t.epoch_number),
                  }))
                }
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setDisplayConfig((prev) => ({ ...prev, selected_epochs: [] }))}
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Saved Templates Grid */}
        {templates.length === 0 ? (
          <EmptyState
            title="No saved UI templates yet"
            subtitle="Generate a design below to populate your template library."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {templates.map((tpl) => {
              const isPinned = displayConfig.mode === 'single' && displayConfig.pinned_epoch === tpl.epoch_number;
              const selectedIdx = displayConfig.selected_epochs.indexOf(tpl.epoch_number);
              const isSelected = selectedIdx >= 0;

              return (
                <div
                  key={tpl.epoch_number}
                  className={`rounded-2xl border p-4 space-y-3 transition ${
                    isPinned || (displayConfig.mode !== 'single' && isSelected)
                      ? 'border-cyan-400/50 bg-cyan-400/[0.07]'
                      : 'border-white/[0.08] bg-[#070a12]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-white/[0.07] text-white font-bold">
                          Gen #{tpl.epoch_number}
                        </span>
                        {isPinned && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-semibold">
                            LIVE NOW
                          </span>
                        )}
                        {displayConfig.mode !== 'single' && isSelected && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 font-semibold">
                            {displayConfig.mode === 'serial' ? `Step #${selectedIdx + 1}` : 'Selected'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-white truncate mt-1.5">{tpl.theme.name}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{tpl.theme.mood}</div>
                    </div>

                    {templates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(tpl.epoch_number)}
                        title="Delete saved template"
                        className="text-slate-500 hover:text-rose-400 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Mini Palette Strip */}
                  <div className="flex items-center gap-1.5">
                    {[tpl.theme.surface, tpl.theme.ink, tpl.theme.accent, tpl.theme.accent2, tpl.theme.accentInk].map(
                      (hex, idx) => (
                        <span
                          key={`${tpl.epoch_number}-${idx}`}
                          title={hex}
                          className="h-4 flex-1 rounded border border-white/15"
                          style={{ backgroundColor: hex }}
                        />
                      ),
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
                    <span className="truncate">{tpl.model_name || 'ai-model'}</span>
                    <span className="shrink-0">
                      {(tpl.html_length / 1024).toFixed(1)} KB
                      {tpl.created_at ? ` · ${new Date(tpl.created_at).toLocaleDateString()}` : ''}
                    </span>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.07]">
                    {displayConfig.mode === 'single' ? (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => void openPreview(tpl.epoch_number)}
                          title="Preview this generated UI"
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.05] text-xs font-medium text-slate-200 hover:bg-white/[0.1] transition cursor-pointer shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          Preview
                        </button>
                        <button
                          type="button"
                          disabled={savingDisplay || isPinned}
                          onClick={() =>
                            void saveDisplayConfig(
                              { ...displayConfig, mode: 'single', pinned_epoch: tpl.epoch_number },
                              `Gen #${tpl.epoch_number} (${tpl.theme.name}) is now LIVE for all visitors!`,
                            )
                          }
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            isPinned
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                              : 'bg-cyan-400 text-slate-950 hover:brightness-105'
                          }`}
                        >
                          {isPinned ? '✓ Currently Live' : 'Set Live'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 text-xs font-mono text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectedEpoch(tpl.epoch_number)}
                            className="w-4 h-4 accent-cyan-400 cursor-pointer"
                          />
                          <span>{isSelected ? 'Included' : 'Include'}</span>
                        </label>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void openPreview(tpl.epoch_number)}
                            title="Preview this generated UI"
                            className="p-1 rounded-md border border-white/10 bg-white/[0.04] text-slate-300 hover:text-cyan-300 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {displayConfig.mode === 'serial' && isSelected && (
                            <>
                              <button
                                type="button"
                                disabled={selectedIdx === 0}
                                onClick={() => moveSelectedEpoch(tpl.epoch_number, -1)}
                                title="Move earlier in serial order"
                                className="p-1 rounded-md border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={selectedIdx === displayConfig.selected_epochs.length - 1}
                                onClick={() => moveSelectedEpoch(tpl.epoch_number, 1)}
                                title="Move later in serial order"
                                className="p-1 rounded-md border border-white/10 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={savingDisplay}
                            onClick={() =>
                              void saveDisplayConfig(
                                { ...displayConfig, mode: 'single', pinned_epoch: tpl.epoch_number },
                                `Gen #${tpl.epoch_number} (${tpl.theme.name}) pinned LIVE!`,
                              )
                            }
                            title="Pin this single UI live"
                            className="px-2 py-1 rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-mono text-cyan-300 hover:bg-cyan-400/15 cursor-pointer"
                          >
                            Pin Live
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Evolution Controls */}
      <Card className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">Generate New Design</h3>
          <p className="text-xs text-slate-400">
            Stage 1 asks your chosen AI for a design concept; Stage 2 builds the HTML5 + CSS3 portfolio. Both responses are saved to the database below.
          </p>
        </div>

        <label className="block space-y-1.5 text-xs">
          <span className="text-slate-300 font-mono">Custom Design Prompt (optional)</span>
          <textarea
            rows={3}
            value={designPrompt}
            onChange={(e) => setDesignPrompt(e.target.value)}
            placeholder="Describe the aesthetic, palette, layout, or typography you want..."
            className={inputClass}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {PROMPT_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setDesignPrompt(idea)}
              className="text-left px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[11px] text-slate-300 hover:border-cyan-400/40 hover:text-white transition cursor-pointer"
            >
              {idea.slice(0, 56)}...
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            disabled={evolving || !designPrompt.trim()}
            onClick={() => void triggerEvolve(designPrompt.trim())}
            className={btnPrimary}
          >
            <Sparkles className="w-4 h-4" />
            {evolving ? 'Generating 2-Stage Design...' : 'Generate with Prompt'}
          </button>

          <button disabled={evolving} onClick={() => void triggerEvolve()} className={btnSecondary}>
            <Shuffle className="w-4 h-4 text-cyan-400" />
            {evolving ? 'Generating...' : 'Randomly Evolve (No Prompt)'}
          </button>
        </div>
      </Card>

      {/* Saved Stage 1 & Stage 2 API Response Logs (Database) */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Stage 1 &amp; Stage 2 API Response Logs</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-cyan-400/15 text-cyan-300 border border-cyan-400/25">
                {logs.length} saved
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect exact Stage 1 design ideas and Stage 2 raw HTML/CSS API responses persisted in Supabase.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshingLogs}
              onClick={() => void reloadLogs()}
              className={btnSecondary}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingLogs ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => void clearLogs()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Logs
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            title="No saved generation responses yet"
            subtitle="Click Generate with Prompt or Randomly Evolve above to capture and inspect Stage 1 & Stage 2 API responses."
          />
        ) : (
          <div className="grid lg:grid-cols-12 gap-5 items-start">
            {/* Run Selector List */}
            <div className="lg:col-span-4 space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {logs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                const isOk = log.status === 'success';
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedLogId(log.id)}
                    className={`w-full text-left rounded-xl border p-3.5 transition space-y-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400/50 bg-cyan-400/10'
                        : 'border-white/[0.08] bg-[#070a12] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="font-bold text-white">
                        {isOk ? `Gen #${log.epoch_number}` : `Attempt (Gen #${log.epoch_number})`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                          isOk ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {isOk ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-200 truncate">
                      {log.theme_name || (isOk ? 'custom-theme' : 'Generation Failed')}
                    </div>

                    {log.custom_prompt && (
                      <div className="text-[11px] text-cyan-300/80 line-clamp-1">
                        Prompt: {log.custom_prompt}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {(log.total_latency_ms / 1000).toFixed(1)}s
                      </span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Run Inspector */}
            {selectedLog && (
              <div className="lg:col-span-8 rounded-2xl border border-white/[0.08] bg-[#070a12] p-4 sm:p-5 space-y-4 min-w-0">
                {/* Metadata Summary Bar */}
                <div className="space-y-2 border-b border-white/[0.08] pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="px-2.5 py-0.5 rounded-md bg-cyan-400/15 text-cyan-300 font-semibold">
                        Gen #{selectedLog.epoch_number}
                      </span>
                      {selectedLog.theme_name && (
                        <span className="text-white font-semibold">{selectedLog.theme_name}</span>
                      )}
                      {selectedLog.layout_signature && (
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300">
                          {selectedLog.layout_signature}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Total: {(selectedLog.total_latency_ms / 1000).toFixed(2)}s
                    </span>
                  </div>

                  {selectedLog.custom_prompt && (
                    <div className="rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-2 text-xs text-slate-300">
                      <span className="font-mono text-cyan-400 mr-1.5">Prompt:</span>
                      {selectedLog.custom_prompt}
                    </div>
                  )}

                  {selectedLog.status === 'error' && selectedLog.error && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs font-mono text-rose-300">
                      Error: {selectedLog.error}
                    </div>
                  )}
                </div>

                {/* Stage Switch Tabs */}
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveStageTab('stage1')}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                      activeStageTab === 'stage1'
                        ? 'border-cyan-400/50 bg-cyan-400/15 text-white'
                        : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Lightbulb className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>Stage 1: Design Idea</span>
                    </span>
                    <span className="text-[10px] font-mono opacity-80 shrink-0">
                      {selectedLog.stage1
                        ? `${selectedLog.stage1.provider}:${selectedLog.stage1.model.slice(0, 14)} · ${(selectedLog.stage1.latency_ms / 1000).toFixed(1)}s`
                        : 'N/A'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveStageTab('stage2')}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${
                      activeStageTab === 'stage2'
                        ? 'border-cyan-400/50 bg-cyan-400/15 text-white'
                        : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <FileCode2 className="w-4 h-4 text-cyan-300 shrink-0" />
                      <span>Stage 2: HTML/CSS Raw</span>
                    </span>
                    <span className="text-[10px] font-mono opacity-80 shrink-0">
                      {selectedLog.stage2
                        ? `${selectedLog.stage2.provider}:${selectedLog.stage2.model.slice(0, 14)} · ${(selectedLog.stage2.latency_ms / 1000).toFixed(1)}s`
                        : 'N/A'}
                    </span>
                  </button>
                </div>

                {/* Active Stage Content */}
                {activeStage ? (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white/[0.06] text-slate-200">
                          {activeStage.provider}:{activeStage.model}
                        </span>
                        <span>{activeStage.latency_ms.toLocaleString()} ms</span>
                        <span>· {activeStage.response.length.toLocaleString()} chars</span>
                      </div>

                      {activeStage.response && (
                        <button
                          type="button"
                          onClick={() => void copyResponse(`${selectedLog.id}-${activeStageTab}`, activeStage.response)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-200 hover:bg-white/[0.08] cursor-pointer"
                        >
                          {copiedField === `${selectedLog.id}-${activeStageTab}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy Response
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {activeStage.error ? (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-mono text-rose-200 whitespace-pre-wrap">
                        Stage Error: {activeStage.error}
                      </div>
                    ) : (
                      <pre className="max-h-[460px] overflow-auto rounded-xl border border-white/10 bg-[#04060b] p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                        {activeStage.response || '(Empty response)'}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-[#04060b] p-6 text-center text-xs font-mono text-slate-400">
                    This stage did not execute for the selected run.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* UI Display & Evolution Settings */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-semibold text-white">Show Top AI Status Bar</div>
              <div className="text-xs text-slate-400">
                Display the slim Gen #, theme, and AI model bar at the top of the public portfolio.
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={uiState.show_ai_bar ?? true}
            onChange={(e) => void updateUiSetting({ show_ai_bar: e.target.checked })}
            className="w-4 h-4 accent-cyan-400 cursor-pointer"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-sm font-semibold text-white">Automatic Background Evolution</div>
              <div className="text-xs text-slate-400">
                Allow the portfolio UI to evolve automatically after the cooldown window expires.
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={uiState.auto_evolve}
            onChange={(e) => void updateUiSetting({ auto_evolve: e.target.checked })}
            className="w-4 h-4 accent-cyan-400 cursor-pointer"
          />
        </div>
      </Card>

      {/* Generated UI Preview Modal */}
      {previewEpoch !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-3 sm:p-5">
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/15 bg-[#090d16] shadow-2xl overflow-hidden">
            {/* Modal Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#070a12]">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <span className="px-2.5 py-1 rounded-md bg-cyan-400/15 border border-cyan-400/30 text-xs font-mono font-bold text-cyan-300">
                  Gen #{previewEpoch}
                </span>
                {previewDetail && (
                  <>
                    <span className="text-sm font-semibold text-white truncate">{previewDetail.theme.name}</span>
                    <span className="hidden sm:inline text-xs font-mono text-slate-400">
                      {previewDetail.model_name || 'ai-model'}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Render / HTML Switch */}
                <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('render')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer transition ${
                      previewTab === 'render' ? 'bg-cyan-400/20 text-cyan-200 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('html')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md cursor-pointer transition ${
                      previewTab === 'html' ? 'bg-cyan-400/20 text-cyan-200 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" /> HTML
                  </button>
                </div>

                {/* Viewport Switcher */}
                {previewTab === 'render' && (
                  <div className="hidden md:inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
                    {(
                      [
                        { id: 'desktop', icon: Monitor, label: 'Desktop' },
                        { id: 'tablet', icon: Tablet, label: 'Tablet' },
                        { id: 'mobile', icon: Smartphone, label: 'Mobile' },
                      ] as const
                    ).map((vp) => {
                      const VpIcon = vp.icon;
                      return (
                        <button
                          key={vp.id}
                          type="button"
                          onClick={() => setPreviewViewport(vp.id)}
                          title={vp.label}
                          className={`p-1.5 rounded-md cursor-pointer transition ${
                            previewViewport === vp.id ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <VpIcon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {previewDetail && (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyResponse(`preview-html-${previewEpoch}`, previewDetail.generated_html)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-slate-200 hover:bg-white/[0.08] cursor-pointer"
                    >
                      {copiedField === `preview-html-${previewEpoch}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Copy HTML</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTemplateHtml(previewDetail)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-slate-200 hover:bg-white/[0.08] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                  </>
                )}

                <Link
                  href={`/admin/ui/preview?epoch=${previewEpoch}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-xs text-slate-200 hover:bg-white/[0.08]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </Link>

                <button
                  type="button"
                  disabled={savingDisplay}
                  onClick={() =>
                    void saveDisplayConfig(
                      { ...displayConfig, mode: 'single', pinned_epoch: previewEpoch },
                      `Gen #${previewEpoch} is now LIVE for all visitors!`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold hover:brightness-105 cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5" /> Set Live
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewEpoch(null)}
                  aria-label="Close preview"
                  className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 bg-[#05070d] flex items-center justify-center overflow-auto">
              {previewTab === 'render' ? (
                <iframe
                  key={`preview-frame-${previewEpoch}`}
                  title={`Preview Gen #${previewEpoch}`}
                  src={`/admin/ui/preview?epoch=${previewEpoch}`}
                  style={{
                    width:
                      previewViewport === 'desktop'
                        ? '100%'
                        : previewViewport === 'tablet'
                          ? '768px'
                          : '390px',
                  }}
                  className="h-full max-w-full border-0 bg-white transition-all duration-200 shadow-2xl"
                />
              ) : loadingPreview ? (
                <LoadingPanel label={`Loading Gen #${previewEpoch} HTML...`} />
              ) : previewError ? (
                <div className="p-6 text-sm text-rose-300">{previewError}</div>
              ) : (
                <pre className="w-full h-full overflow-auto p-5 text-xs font-mono text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                  {previewDetail?.generated_html || ''}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
