'use client';

import { useEffect, useState } from 'react';
import { Trash2, Check, Archive, Mail } from 'lucide-react';
import type { ContactMessage } from '@portfolio/shared';
import { adminFetch } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminProvider';
import { AlertBanner, EmptyState, LoadingPanel, PageHeader } from '@/components/admin/AdminUi';

type StatusFilter = 'all' | ContactMessage['status'];

export default function AdminMessagesPage() {
  const { token, refreshUnreadCount, toast } = useAdmin();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminFetch<ContactMessage[]>('/messages', token)
      .then((data) => {
        if (active) setMessages(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load messages');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function markMessage(id: string, status: ContactMessage['status']) {
    if (!token) return;
    try {
      const updated = await adminFetch<ContactMessage>(`/messages/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessages(messages.map((m) => (m.id === id ? updated : m)));
      void refreshUnreadCount();
      toast.info(`Message marked as ${status}.`, 'Inbox Updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function deleteMessage(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/messages/${id}`, token, { method: 'DELETE' });
      setMessages(messages.filter((m) => m.id !== id));
      setNotice('Message deleted.');
      toast.success('Message deleted from inbox.', 'Message Deleted');
      void refreshUnreadCount();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
      toast.error(msg);
    }
  }

  if (loading) return <LoadingPanel label="Loading inbox..." />;

  const counts = {
    all: messages.length,
    unread: messages.filter((m) => m.status === 'unread').length,
    read: messages.filter((m) => m.status === 'read').length,
    archived: messages.filter((m) => m.status === 'archived').length,
  };

  const filtered = filter === 'all' ? messages : messages.filter((m) => m.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages Inbox"
        description="Read, reply to, archive, or remove contact form submissions from visitors."
      />

      <AlertBanner
        notice={notice}
        error={error}
        onClear={() => {
          setNotice('');
          setError('');
        }}
      />

      <div className="flex flex-wrap gap-2">
        {(['all', 'unread', 'read', 'archived'] as StatusFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono capitalize border transition cursor-pointer ${
              filter === key
                ? 'bg-cyan-400/15 border-cyan-400/40 text-cyan-300'
                : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white'
            }`}
          >
            {key} ({counts[key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No messages in this view" subtitle="When visitors contact you, messages will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border p-5 space-y-3 transition ${
                m.status === 'unread'
                  ? 'border-cyan-400/30 bg-cyan-400/[0.04]'
                  : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="font-bold text-white">{m.sender_name}</span>
                  <a
                    href={`mailto:${m.sender_email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                    className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" /> {m.sender_email}
                  </a>
                  <span className="text-slate-500">· {new Date(m.created_at).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span
                    className={`px-2.5 py-0.5 rounded-full ${
                      m.status === 'unread'
                        ? 'bg-amber-400/15 text-amber-300'
                        : m.status === 'read'
                          ? 'bg-emerald-400/15 text-emerald-300'
                          : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {m.status}
                  </span>
                  {m.status === 'unread' && (
                    <button
                      onClick={() => void markMessage(m.id, 'read')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Read
                    </button>
                  )}
                  {m.status !== 'archived' && (
                    <button
                      onClick={() => void markMessage(m.id, 'archived')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" /> Archive
                    </button>
                  )}
                  <button
                    onClick={() => void deleteMessage(m.id)}
                    title="Delete message"
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-sm font-semibold text-white">{m.subject}</div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
