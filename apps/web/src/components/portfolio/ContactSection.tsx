'use client';

import { useState, useCallback, type FormEvent, type CSSProperties } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import type { PortfolioPayload } from '@portfolio/shared';
import { API_URL } from '@/lib/api';
import { TurnstileWidget } from './TurnstileWidget';

type PortfolioTheme = NonNullable<PortfolioPayload['uiState']>['theme'];

export function ContactSection({
  email,
  location,
  theme,
}: {
  email: string;
  location: string;
  theme?: PortfolioTheme;
}) {
  const [form, setForm] = useState({ sender_name: '', sender_email: '', subject: '', message: '' });
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const handleToken = useCallback((token: string) => setTurnstileToken(token), []);

  const surface = theme?.surface || '#0b0f19';
  const ink = theme?.ink || '#f1f5f9';
  const accent = theme?.accent || '#06b6d4';
  const accent2 = theme?.accent2 || accent;
  const accentInk = theme?.accentInk || '#020617';
  const borderSoft = `color-mix(in srgb, ${ink} 18%, transparent)`;
  const mutedInk = `color-mix(in srgb, ${ink} 68%, transparent)`;
  const inputBg = `color-mix(in srgb, ${ink} 5%, ${surface})`;
  const fontFamily =
    theme?.fontStyle === 'mono'
      ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
      : theme?.fontStyle === 'serif'
        ? 'Georgia, Cambria, "Times New Roman", serif'
        : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setFeedback('');
    try {
      const res = await fetch(`${API_URL}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstile_token: turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setStatus('sent');
      setFeedback(data.message || 'Message received!');
      setForm({ sender_name: '', sender_email: '', subject: '', message: '' });
    } catch (err) {
      setStatus('error');
      setFeedback(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <section className="space-y-5" style={fontFamily ? ({ fontFamily, color: ink } as CSSProperties) : ({ color: ink } as CSSProperties)}>
      <div>
        <div
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
            borderColor: `color-mix(in srgb, ${accent} 38%, transparent)`,
            color: accent,
          }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md border font-mono text-xs mb-2"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>CONTACT</span>
        </div>
        <h2 className="text-2xl font-extrabold" style={{ color: ink }}>
          Send a Direct Message
        </h2>
        <p className="mt-1 text-xs font-mono" style={{ color: mutedInk }}>
          {email} • {location}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            required
            placeholder="Your Name"
            value={form.sender_name}
            onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
            style={{ borderColor: borderSoft, backgroundColor: inputBg, color: ink }}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
          />
          <input
            required
            type="email"
            placeholder="Your Email"
            value={form.sender_email}
            onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
            style={{ borderColor: borderSoft, backgroundColor: inputBg, color: ink }}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
          />
        </div>
        <input
          required
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          style={{ borderColor: borderSoft, backgroundColor: inputBg, color: ink }}
          className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
        />
        <textarea
          required
          rows={4}
          placeholder="Your message..."
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          style={{ borderColor: borderSoft, backgroundColor: inputBg, color: ink }}
          className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
        />

        {status === 'sent' && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> {feedback}
          </p>
        )}
        {status === 'error' && (
          <p className="flex items-center gap-2 text-sm text-rose-400">
            <AlertCircle className="w-4 h-4" /> {feedback}
          </p>
        )}

        <TurnstileWidget onToken={handleToken} />

        <button
          disabled={status === 'sending'}
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            color: accentInk,
          }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{status === 'sending' ? 'Sending...' : 'Send Message'}</span>
        </button>
      </form>
    </section>
  );
}
