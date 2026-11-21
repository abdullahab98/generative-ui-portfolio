'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Save, Zap, Bot, Sliders, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  DEFAULT_AI_ROUTING,
  type AiProvider,
  type AiRouting,
  type AiSettings,
} from '@portfolio/shared';
import { adminFetch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminProvider';
import {
  AlertBanner,
  Card,
  LoadingPanel,
  PageHeader,
  btnPrimary,
  inputClass,
} from '@/components/admin/AdminUi';

type AiTestResult = {
  ok: boolean;
  provider?: AiProvider;
  model: string;
  latencyMs: number;
  reply?: string;
  error?: string;
};

const MODEL_PRESETS: Record<AiProvider, string[]> = {
  gemini: [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
  ],
  crowllm: ['openai/gpt-oss-20b:free'],
};

export default function AdminAiPage() {
  const { token, toast } = useAdmin();
  const [ai, setAi] = useState<AiSettings | null>(null);
  const [routing, setRouting] = useState<AiRouting>(DEFAULT_AI_ROUTING);
  const [providers, setProviders] = useState<Record<AiProvider, boolean>>({ gemini: false, crowllm: false });
  const [loading, setLoading] = useState(true);
  const [savingRouting, setSavingRouting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [testProvider, setTestProvider] = useState<AiProvider>('gemini');
  const [testModel, setTestModel] = useState('gemini-3.5-flash-lite');
  const [testPrompt, setTestPrompt] = useState('Hello! Confirm you are live and tell me one thing you can do.');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([
      adminFetch<AiSettings>('/ai-settings', token),
      adminFetch<{ routing: AiRouting; providers: Record<AiProvider, boolean> }>('/ai-routing', token),
    ])
      .then(([settingsData, routingData]) => {
        if (!active) return;
        setAi(settingsData);
        setRouting(routingData.routing);
        setProviders(routingData.providers);
        setTestProvider(routingData.routing.chat_provider);
        setTestModel(routingData.routing.chat_model);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load AI configuration');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function saveRouting(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSavingRouting(true);
    setError('');
    setNotice('');
    try {
      const res = await adminFetch<{ routing: AiRouting; providers: Record<AiProvider, boolean> }>(
        '/ai-routing',
        token,
        {
          method: 'PUT',
          body: JSON.stringify(routing),
        },
      );
      setRouting(res.routing);
      setProviders(res.providers);
      setNotice('AI provider & model routing saved! All tasks will now use your selected models.');
      toast.success('AI provider & model routing saved!', 'Routing Updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save routing';
      setError(msg);
      toast.error(msg, 'Routing Failed');
    } finally {
      setSavingRouting(false);
    }
  }

  async function saveAi(e: FormEvent) {
    e.preventDefault();
    if (!token || !ai) return;
    setSavingSettings(true);
    setError('');
    setNotice('');
    try {
      const updated = await adminFetch<AiSettings>('/ai-settings', token, {
        method: 'PUT',
        body: JSON.stringify(ai),
      });
      setAi(updated);
      setNotice('AI assistant settings saved.');
      toast.success('AI assistant settings saved.', 'Chat Settings Updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
      toast.error(msg, 'Save Failed');
    } finally {
      setSavingSettings(false);
    }
  }

  async function runLiveTest() {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminFetch<AiTestResult>('/ai-test', token, {
        method: 'POST',
        body: JSON.stringify({
          provider: testProvider,
          model: testModel,
          prompt: testPrompt,
        }),
      });
      setTestResult(res);
      if (res.ok) {
        toast.success(`${res.provider}:${res.model} responded in ${res.latencyMs}ms`, 'AI Live');
      } else {
        toast.error(res.error || 'AI test failed', 'AI Offline');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setTestResult({
        ok: false,
        provider: testProvider,
        model: testModel,
        latencyMs: 0,
        error: msg,
      });
      toast.error(msg, 'Test Failed');
    } finally {
      setTesting(false);
    }
  }

  if (loading || !ai) return <LoadingPanel label="Loading AI control center..." />;

  const taskRows: Array<{
    title: string;
    subtitle: string;
    providerKey: 'chat_provider' | 'ui_idea_provider' | 'ui_gen_provider';
    modelKey: 'chat_model' | 'ui_idea_model' | 'ui_gen_model';
  }> = [
    {
      title: 'Portfolio Chat Assistant',
      subtitle: 'Answers visitor questions in the floating ChatWidget',
      providerKey: 'chat_provider',
      modelKey: 'chat_model',
    },
    {
      title: 'UI Design Idea (Stage 1)',
      subtitle: 'Invents creative art direction, palette, and layout concept before coding',
      providerKey: 'ui_idea_provider',
      modelKey: 'ui_idea_model',
    },
    {
      title: 'UI HTML/CSS Generator (Stage 2)',
      subtitle: 'Builds the complete responsive single-page HTML5 + CSS3 portfolio',
      providerKey: 'ui_gen_provider',
      modelKey: 'ui_gen_model',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Control Center"
        description="Choose exactly which AI provider and model runs each task, configure chat behavior, and test live."
      />

      <AlertBanner
        notice={notice}
        error={error}
        onClear={() => {
          setNotice('');
          setError('');
        }}
      />

      {/* Provider Key Status */}
      <div className="grid sm:grid-cols-2 gap-3">
        {(['gemini', 'crowllm'] as AiProvider[]).map((prov) => {
          const ready = providers[prov];
          return (
            <div
              key={prov}
              className={`rounded-2xl border px-4 py-3.5 flex items-center justify-between ${
                ready ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-amber-500/25 bg-amber-500/[0.06]'
              }`}
            >
              <div>
                <div className="text-sm font-semibold text-white capitalize">
                  {prov === 'gemini' ? 'Google Gemini API' : 'CrowLLM API'}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {prov === 'gemini' ? 'GOOGLE_GENERATIVE_AI_API_KEY' : 'CROWLLM_API_KEY'}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold ${
                  ready ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {ready ? 'Configured' : 'Missing Key'}
              </span>
            </div>
          );
        })}
      </div>

      {/* AI Provider & Model Routing */}
      <Card>
        <form onSubmit={saveRouting} className="space-y-5">
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Task-to-AI Model Routing</span>
          </div>

          <div className="space-y-3">
            {taskRows.map((row) => {
              const selectedProvider = routing[row.providerKey];
              const presets = MODEL_PRESETS[selectedProvider];
              return (
                <div
                  key={row.providerKey}
                  className="rounded-xl border border-white/[0.08] bg-[#070a12] p-4 grid md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-4">
                    <div className="text-sm font-semibold text-white">{row.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{row.subtitle}</div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block space-y-1 text-[11px] font-mono text-slate-400">
                      <span>Provider</span>
                      <select
                        value={selectedProvider}
                        onChange={(e) => {
                          const nextProv = e.target.value as AiProvider;
                          setRouting({
                            ...routing,
                            [row.providerKey]: nextProv,
                            [row.modelKey]: MODEL_PRESETS[nextProv][0],
                          });
                        }}
                        className={inputClass}
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="crowllm">CrowLLM</option>
                      </select>
                    </label>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block space-y-1 text-[11px] font-mono text-slate-400">
                      <span>Model ID</span>
                      <input
                        list={`presets-${row.modelKey}`}
                        value={routing[row.modelKey]}
                        onChange={(e) => setRouting({ ...routing, [row.modelKey]: e.target.value })}
                        placeholder="Enter or pick model ID"
                        className={inputClass}
                      />
                      <datalist id={`presets-${row.modelKey}`}>
                        {presets.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <button disabled={savingRouting} className={btnPrimary}>
            <Save className="w-4 h-4" /> {savingRouting ? 'Saving Routing...' : 'Save AI Routing'}
          </button>
        </form>
      </Card>

      {/* Live AI Tester */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" /> Live AI Connection &amp; Response Test
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Test any provider and model directly with a live prompt.</p>
          </div>
          {testResult && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                testResult.ok
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/35'
              }`}
            >
              {testResult.ok ? 'LIVE' : 'OFFLINE'} · {testResult.latencyMs}ms · {testResult.provider}:{testResult.model}
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <select
            value={testProvider}
            onChange={(e) => {
              const p = e.target.value as AiProvider;
              setTestProvider(p);
              setTestModel(MODEL_PRESETS[p][0]);
            }}
            className={inputClass}
          >
            <option value="gemini">Google Gemini</option>
            <option value="crowllm">CrowLLM</option>
          </select>
          <input
            value={testModel}
            onChange={(e) => setTestModel(e.target.value)}
            placeholder="Model ID"
            className={`${inputClass} sm:col-span-2`}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder="Enter a test prompt..."
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            disabled={testing}
            onClick={() => void runLiveTest()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50 transition cursor-pointer shrink-0"
          >
            <Zap className="w-4 h-4" /> {testing ? 'Testing...' : 'Test AI Live'}
          </button>
        </div>

        {testResult && (
          <div className="rounded-xl border border-white/10 bg-[#05070d] p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {testResult.ok ? (
              <span className="text-emerald-200">{testResult.reply}</span>
            ) : (
              <span className="text-rose-300">Error: {testResult.error}</span>
            )}
          </div>
        )}
      </Card>

      {/* ChatWidget Prompt & Toggle */}
      <Card>
        <form onSubmit={saveAi} className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#070a12] px-4 py-3">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="text-sm font-semibold text-white">Enable Portfolio AI ChatWidget</div>
                <div className="text-xs text-slate-400">Show the floating &quot;Ask AI&quot; assistant on the public portfolio</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={ai.is_enabled}
              onChange={(e) => setAi({ ...ai, is_enabled: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 cursor-pointer"
            />
          </div>

          <label className="block space-y-1.5 text-xs">
            <span className="text-slate-300 font-mono">ChatWidget System Prompt</span>
            <textarea
              rows={4}
              value={ai.system_prompt}
              onChange={(e) => setAi({ ...ai, system_prompt: e.target.value })}
              className={inputClass}
            />
          </label>

          <button disabled={savingSettings} className={btnPrimary}>
            <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Chat Settings'}
          </button>
        </form>
      </Card>
    </div>
  );
}
