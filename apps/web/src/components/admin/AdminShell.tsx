'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserCircle,
  Cpu,
  FolderKanban,
  BookOpen,
  Mail,
  Bot,
  Sparkles,
  ExternalLink,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { AdminProvider, useAdmin } from './AdminProvider';
import { LoadingPanel } from './AdminUi';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/profile', label: 'Profile', icon: UserCircle },
  { href: '/admin/skills', label: 'Skills', icon: Cpu },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/publications', label: 'Publications', icon: BookOpen },
  { href: '/admin/messages', label: 'Messages', icon: Mail, hasBadge: true },
  { href: '/admin/ai', label: 'AI Assistant', icon: Bot },
  { href: '/admin/ui', label: 'Generative UI', icon: Sparkles },
] as const;

function AdminShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { token, checkingAuth, userEmail, unreadCount, signOut, toasts, dismissToast } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav =
    NAV_ITEMS.find((item) => ('exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href))) ??
    NAV_ITEMS[0];

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.08]">
        <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Md. Abdullah" className="w-9 h-9 rounded-xl shadow-lg shadow-cyan-500/20" />
          <div>
            <div className="text-sm font-bold text-white leading-tight">Portfolio Studio</div>
            <div className="text-[11px] font-mono text-cyan-400">Admin Console</div>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = 'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30 shadow-sm'
                  : 'text-slate-400 border border-transparent hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span>{item.label}</span>
              </span>
              {'hasBadge' in item && item.hasBadge && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-400 text-slate-950">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.08] p-4 space-y-3">
        {userEmail && (
          <div className="px-2 text-[11px] font-mono text-slate-500 truncate" title={userEmail}>
            {userEmail}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white transition"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Live Site
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-white/[0.08] bg-[#090d16]/90 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-[#090d16] border-r border-white/10 h-full shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-white/[0.08] bg-[#06080f]/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 truncate">
              <Link href="/admin" className="hover:text-cyan-400 transition">
                admin
              </Link>
              <span>/</span>
              <span className="text-slate-100 font-semibold">{currentNav.label.toLowerCase()}</span>
            </div>
          </div>

          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-mono text-cyan-300 hover:bg-cyan-400/20 transition shrink-0"
          >
            View Portfolio <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {children}
        </main>
      </div>

      {(checkingAuth || !token) && (
        <div className="fixed inset-0 z-50 bg-[#06080f] flex items-center justify-center">
          <LoadingPanel label="Verifying admin session..." />
        </div>
      )}

      {/* Global Admin Toaster */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 w-[calc(100vw-2.5rem)] max-w-sm pointer-events-none"
        >
          {toasts.map((item) => {
            const isErr = item.type === 'error';
            const isInfo = item.type === 'info';
            return (
              <div
                key={item.id}
                className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-xl px-4 py-3.5 shadow-2xl transition-all duration-200 flex items-start gap-3 ${
                  isErr
                    ? 'border-rose-500/40 bg-[#140b12]/95 text-rose-100 shadow-rose-950/50'
                    : isInfo
                      ? 'border-cyan-400/40 bg-[#08131d]/95 text-cyan-50 shadow-cyan-950/50'
                      : 'border-emerald-400/40 bg-[#081612]/95 text-emerald-50 shadow-emerald-950/50'
                }`}
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isErr ? 'bg-rose-400' : isInfo ? 'bg-cyan-400' : 'bg-emerald-400'
                  }`}
                />
                {isErr ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : isInfo ? (
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  {item.title && <div className="text-xs font-mono font-bold tracking-wide">{item.title}</div>}
                  <div className="text-xs opacity-90 mt-0.5 leading-relaxed break-words">{item.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(item.id)}
                  aria-label="Dismiss notification"
                  className="opacity-60 hover:opacity-100 transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }
  return (
    <AdminProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminProvider>
  );
}
