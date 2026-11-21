'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }
    router.push('/admin');
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <span>Admin Login</span>
          </h1>
          <Link href="/" className="text-xs font-mono text-slate-400 hover:text-cyan-400 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Portfolio
          </Link>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            required
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-500"
          />
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-500"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 font-semibold text-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
