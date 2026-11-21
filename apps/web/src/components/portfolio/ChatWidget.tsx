'use client';

import { useState, useCallback, type FormEvent, type CSSProperties } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import type { PortfolioPayload } from '@portfolio/shared';
import { API_URL } from '@/lib/api';
import { TurnstileWidget } from './TurnstileWidget';

type Msg = { role: 'user' | 'assistant'; content: string };
type PortfolioTheme = NonNullable<PortfolioPayload['uiState']>['theme'];

export function ChatWidget({
  enabled,
  quickPrompts,
  theme,
}: {
  enabled: boolean;
  quickPrompts: string[];
  theme?: PortfolioTheme;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);
  const handleToken = useCallback((t: string) => setTurnstileToken(t), []);

  if (!enabled) return null;

  const surface = theme?.surface || '#0b0f19';
  const ink = theme?.ink || '#f1f5f9';
  const accent = theme?.accent || '#06b6d4';
  const accent2 = theme?.accent2 || accent;
  const accentInk = theme?.accentInk || '#020617';
  const fontFamily =
    theme?.fontStyle === 'mono'
      ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
      : theme?.fontStyle === 'serif'
        ? 'Georgia, Cambria, "Times New Roman", serif'
        : undefined;

  const borderSoft = `color-mix(in srgb, ${ink} 16%, transparent)`;
  const mutedInk = `color-mix(in srgb, ${ink} 68%, transparent)`;

  async function sendText(text: string) {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, turnstile_token: turnstileToken }),
      });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: data.reply || data.error || 'No response.' }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Could not reach the AI assistant.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendText(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50" style={fontFamily ? ({ fontFamily } as CSSProperties) : undefined}>
      {open ? (
        <div
          style={{
            backgroundColor: surface,
            color: ink,
            borderColor: borderSoft,
            boxShadow: `0 20px 50px color-mix(in srgb, ${surface} 70%, #000)`,
          }}
          className="w-80 sm:w-96 rounded-2xl border overflow-hidden flex flex-col max-h-[500px]"
        >
          <div
            style={{
              background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 22%, transparent), color-mix(in srgb, ${accent2} 22%, transparent))`,
              borderColor: borderSoft,
            }}
            className="flex items-center justify-between px-4 py-3 border-b"
          >
            <span className="flex items-center gap-2 text-xs font-mono font-bold" style={{ color: ink }}>
              <Sparkles className="w-4 h-4" style={{ color: accent }} /> Portfolio AI Assistant
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close AI Assistant"
              style={{ color: mutedInk }}
              className="hover:opacity-100 opacity-80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-2.5 overflow-y-auto flex-1 text-xs">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p style={{ color: mutedInk }}>Ask anything about projects, skills, or publications:</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((q) => (
                    <button
                      key={q}
                      onClick={() => void sendText(q)}
                      style={{
                        borderColor: `color-mix(in srgb, ${accent} 38%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                        color: ink,
                      }}
                      className="text-left px-2.5 py-1.5 rounded-lg border hover:opacity-90 transition cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={
                  m.role === 'user'
                    ? { backgroundColor: accent, color: accentInk }
                    : {
                        backgroundColor: `color-mix(in srgb, ${ink} 8%, transparent)`,
                        color: ink,
                        border: `1px solid color-mix(in srgb, ${ink} 10%, transparent)`,
                      }
                }
                className={`p-2.5 rounded-xl whitespace-pre-wrap ${m.role === 'user' ? 'ml-8 font-medium' : 'mr-8'}`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="font-mono" style={{ color: mutedInk }}>
                Thinking...
              </div>
            )}
          </div>

          <div className="px-2.5 pt-1">
            <TurnstileWidget onToken={handleToken} />
          </div>
          <form onSubmit={onSubmit} style={{ borderColor: borderSoft }} className="p-2.5 border-t flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              style={{
                borderColor: borderSoft,
                color: ink,
                backgroundColor: `color-mix(in srgb, ${ink} 4%, transparent)`,
              }}
              className="flex-1 rounded-xl border px-3 py-2 text-xs outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: accent, color: accentInk }}
              className="p-2 rounded-xl hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI Assistant"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            color: accentInk,
            boxShadow: `0 10px 28px color-mix(in srgb, ${accent} 38%, transparent)`,
            border: `1px solid color-mix(in srgb, ${ink} 18%, transparent)`,
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-full font-semibold text-xs hover:scale-105 transition cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ask AI</span>
        </button>
      )}
    </div>
  );
}
