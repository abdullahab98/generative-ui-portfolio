'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  FolderKanban,
  BookOpen,
  Mail,
  Sparkles,
  Bot,
  ArrowUpRight,
  UserCircle,
  Palette,
} from 'lucide-react';
import type { ContactMessage, PortfolioUiState } from '@portfolio/shared';
import { adminFetch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AlertBanner, Card, LoadingPanel, PageHeader } from '@/components/admin/AdminUi';

type OverviewData = {
  skillsCount: number;
  projectsCount: number;
  publicationsCount: number;
  unreadMessagesCount: number;
};

export default function AdminDashboardOverviewPage() {
  const { token } = useAdmin();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [uiState, setUiState] = useState<PortfolioUiState | null>(null);
  const [recentMessages, setRecentMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([
      adminFetch<OverviewData>('/overview', token),
      adminFetch<PortfolioUiState | null>('/ui-state', token),
      adminFetch<ContactMessage[]>('/messages', token),
    ])
      .then(([ov, ui, msgs]) => {
        if (!active) return;
        setOverview(ov);
        setUiState(ui);
        setRecentMessages(msgs.slice(0, 4));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load overview');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) return <LoadingPanel label="Loading dashboard overview..." />;

  const stats = [
    {
      label: 'Skills',
      value: overview?.skillsCount ?? 0,
      href: '/admin/skills',
      icon: Cpu,
      accent: 'from-cyan-400/20 to-teal-400/10 text-cyan-300 border-cyan-400/25',
    },
    {
      label: 'Projects',
      value: overview?.projectsCount ?? 0,
      href: '/admin/projects',
      icon: FolderKanban,
      accent: 'from-indigo-400/20 to-violet-400/10 text-indigo-300 border-indigo-400/25',
    },
    {
      label: 'Publications',
      value: overview?.publicationsCount ?? 0,
      href: '/admin/publications',
      icon: BookOpen,
      accent: 'from-emerald-400/20 to-teal-400/10 text-emerald-300 border-emerald-400/25',
    },
    {
      label: 'Unread Messages',
      value: overview?.unreadMessagesCount ?? 0,
      href: '/admin/messages',
      icon: Mail,
      accent: 'from-amber-400/20 to-orange-400/10 text-amber-300 border-amber-400/25',
    },
  ];

  const quickLinks = [
    { href: '/admin/ui', title: 'Generative UI Studio', desc: 'Evolve layout with prompt or random seed', icon: Sparkles },
    { href: '/admin/ai', title: 'AI Assistant & Test', desc: 'Configure prompt & test live AI latency', icon: Bot },
    { href: '/admin/profile', title: 'Edit Profile & Resume', desc: 'Update bio, headline, social links & PDF', icon: UserCircle },
    { href: '/admin/projects', title: 'Manage Projects', desc: 'Add, edit or publish portfolio projects', icon: FolderKanban },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your portfolio content, inbox, and self-evolving generative UI."
      />

      <AlertBanner error={error} onClear={() => setError('')} />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-cyan-400/35 hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center ${item.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 transition" />
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold text-white">{item.value}</div>
                <div className="text-xs font-mono text-slate-400 mt-1">{item.label}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Current Generative UI Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Palette className="w-4 h-4 text-cyan-400" />
              <span>Active Generative UI</span>
            </div>
            <Link
              href="/admin/ui"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              Open Studio <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {uiState ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#070a12] p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-400/15 text-cyan-300">
                    Gen #{uiState.epoch_number}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300">
                    {uiState.model_name ?? 'gemini-3.5-flash-lite'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md ${
                      uiState.auto_evolve ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {uiState.auto_evolve ? 'Auto-Evolve ON' : 'Auto-Evolve OFF'}
                  </span>
                </div>
                <div className="text-lg font-bold text-white">{uiState.theme.name}</div>
                <p className="text-xs text-slate-400">{uiState.theme.mood}</p>
              </div>

              <div className="flex items-center gap-2">
                {[
                  { label: 'Surface', hex: uiState.theme.surface },
                  { label: 'Ink', hex: uiState.theme.ink },
                  { label: 'Accent', hex: uiState.theme.accent },
                  { label: 'Accent 2', hex: uiState.theme.accent2 },
                ].map((swatch) => (
                  <div key={swatch.label} className="flex-1 rounded-xl border border-white/10 p-2 bg-[#070a12]">
                    <div className="h-6 rounded-md border border-white/10" style={{ backgroundColor: swatch.hex }} />
                    <div className="text-[10px] font-mono text-slate-400 mt-1.5">{swatch.label}</div>
                    <div className="text-[10px] font-mono text-slate-300">{swatch.hex}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No UI generated yet.</p>
          )}
        </Card>

        {/* Recent Messages */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Recent Messages</span>
            </div>
            <Link
              href="/admin/messages"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              View Inbox <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentMessages.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No contact messages yet.</p>
          ) : (
            <div className="space-y-2.5">
              {recentMessages.map((m) => (
                <Link
                  key={m.id}
                  href="/admin/messages"
                  className="block rounded-xl border border-white/[0.07] bg-[#070a12] p-3.5 hover:border-cyan-400/30 transition"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-100 truncate">{m.sender_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                        m.status === 'unread'
                          ? 'bg-amber-400/15 text-amber-300'
                          : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-300 mt-1 truncate">{m.subject}</div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.message}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.href}
              href={q.href}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 hover:border-cyan-400/35 hover:bg-white/[0.04] transition space-y-2"
            >
              <Icon className="w-5 h-5 text-cyan-400" />
              <div className="text-sm font-semibold text-white">{q.title}</div>
              <p className="text-xs text-slate-400">{q.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
