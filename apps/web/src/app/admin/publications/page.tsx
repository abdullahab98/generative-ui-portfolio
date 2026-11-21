'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, X, Sparkles } from 'lucide-react';
import type { PortfolioUiState, Publication } from '@portfolio/shared';
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

const EMPTY_PUB = {
  title: '',
  venue: '',
  published_year: 2026,
  authors: 'Md. Abdullah',
  abstract: '',
  paper_url: '',
  doi: '',
  tags: 'AI, Systems',
  is_published: true,
  sort_order: 0,
};

export default function AdminPublicationsPage() {
  const { token, toast } = useAdmin();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingUi, setSyncingUi] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PUB);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const sortPubs = (list: Publication[]) =>
    [...list].sort((a, b) => a.sort_order - b.sort_order || b.published_year - a.published_year);

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminFetch<Publication[]>('/publications', token)
      .then((data) => {
        if (active) setPublications(sortPubs(data));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load publications');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function savePublication(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setNotice('');
    const payload = {
      ...form,
      published_year: Number(form.published_year),
      sort_order: editingId ? Number(form.sort_order) : Number(form.sort_order) || publications.length + 1,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) {
        const updated = await adminFetch<Publication>(`/publications/${editingId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setPublications(sortPubs(publications.map((p) => (p.id === editingId ? updated : p))));
        setEditingId(null);
        setNotice(`Updated "${updated.title}" in database.`);
        toast.success(`Updated "${updated.title}" in database.`, 'Publication Updated');
      } else {
        const created = await adminFetch<Publication>('/publications', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setPublications(sortPubs([created, ...publications]));
        setNotice(`Added "${created.title}" to database.`);
        toast.success(`Added "${created.title}" to database.`, 'Publication Added');
      }
      setForm(EMPTY_PUB);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save publication';
      setError(msg);
      toast.error(msg, 'Publication Error');
    }
  }

  async function togglePublished(pub: Publication) {
    if (!token) return;
    try {
      const updated = await adminFetch<Publication>(`/publications/${pub.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: !pub.is_published }),
      });
      setPublications(sortPubs(publications.map((x) => (x.id === pub.id ? updated : x))));
      toast.info(`"${updated.title}" is now ${updated.is_published ? 'Published' : 'Hidden'}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Toggle failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function deletePublication(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/publications/${id}`, token, { method: 'DELETE' });
      setPublications(publications.filter((p) => p.id !== id));
      setNotice('Publication deleted from database.');
      toast.success('Publication deleted from database.', 'Publication Deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function syncToLiveUi() {
    if (!token) return;
    setSyncingUi(true);
    setError('');
    setNotice('');
    try {
      const updated = await adminFetch<PortfolioUiState | null>('/ui-state/evolve', token, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (updated) {
        const msg = `Synced all publications into live AI UI (Gen #${updated.epoch_number} · ${updated.theme.name}).`;
        setNotice(msg);
        toast.success(msg, 'Live UI Synced');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'UI sync failed';
      setError(msg);
      toast.error(msg, 'Sync Failed');
    } finally {
      setSyncingUi(false);
    }
  }

  if (loading) return <LoadingPanel label="Loading publications..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research & Publications"
        description="Full database edit access for papers & datasets (venue, year, authors, DOI, URL, abstract, tags, order, visibility)."
        action={
          <button disabled={syncingUi} onClick={() => void syncToLiveUi()} className={btnSecondary}>
            <Sparkles className="w-4 h-4 text-cyan-400" />
            {syncingUi ? 'Syncing Live UI...' : 'Sync to Live UI'}
          </button>
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

      <Card>
        <form onSubmit={savePublication} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="sm:col-span-2 lg:col-span-3 space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Title</span>
            <input
              required
              placeholder="Paper or Dataset Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Venue / Publisher</span>
            <input
              required
              placeholder="Science Data Bank / IEEE / arXiv"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Published Year</span>
            <input
              required
              type="number"
              min={1990}
              max={2100}
              value={form.published_year}
              onChange={(e) => setForm({ ...form, published_year: Number(e.target.value) })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Sort Order</span>
            <input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs lg:col-span-2">
            <span className="text-slate-400 font-mono">Authors</span>
            <input
              required
              placeholder="Author 1, Author 2, Md. Abdullah"
              value={form.authors}
              onChange={(e) => setForm({ ...form, authors: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Tags (comma separated)</span>
            <input
              placeholder="Computer Vision, Dataset, CC BY 4.0"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs lg:col-span-2">
            <span className="text-slate-400 font-mono">Paper / DOI URL</span>
            <input
              placeholder="https://doi.org/..."
              value={form.paper_url}
              onChange={(e) => setForm({ ...form, paper_url: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">DOI</span>
            <input
              placeholder="10.57760/sciencedb.25907"
              value={form.doi}
              onChange={(e) => setForm({ ...form, doi: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2 lg:col-span-3 space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Abstract</span>
            <textarea
              rows={3}
              placeholder="Research summary or dataset description..."
              value={form.abstract}
              onChange={(e) => setForm({ ...form, abstract: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 cursor-pointer"
            />
            <span>Published</span>
          </label>

          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2 pt-1">
            <button className={btnPrimary}>
              <Plus className="w-4 h-4" /> {editingId ? 'Update Publication' : 'Add Publication'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_PUB);
                }}
                className={btnSecondary}
              >
                <X className="w-4 h-4" /> Cancel Edit
              </button>
            )}
          </div>
        </form>
      </Card>

      {publications.length === 0 ? (
        <EmptyState title="No publications yet" subtitle="Add a research paper or dataset above." />
      ) : (
        <div className="space-y-3.5">
          {publications.map((pub) => (
            <div
              key={pub.id}
              className={`rounded-2xl border p-5 space-y-3 transition ${
                pub.is_published
                  ? 'border-white/[0.08] bg-white/[0.025] hover:border-cyan-400/30'
                  : 'border-white/[0.05] bg-white/[0.01] opacity-65'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-400">#{pub.sort_order}</span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-400/15 text-cyan-300">{pub.published_year}</span>
                    <span className="text-slate-400">{pub.venue}</span>
                    {pub.doi && <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300">DOI: {pub.doi}</span>}
                  </div>
                  <h3 className="text-base font-semibold text-white">{pub.title}</h3>
                  <div className="text-xs text-slate-400">{pub.authors}</div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => void togglePublished(pub)}
                    title={pub.is_published ? 'Hide publication' : 'Publish'}
                    className="text-slate-400 hover:text-cyan-400 cursor-pointer"
                  >
                    {pub.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(pub.id);
                      setForm({
                        title: pub.title,
                        venue: pub.venue,
                        published_year: pub.published_year,
                        authors: pub.authors,
                        abstract: pub.abstract,
                        paper_url: pub.paper_url,
                        doi: pub.doi,
                        tags: pub.tags.join(', '),
                        is_published: pub.is_published,
                        sort_order: pub.sort_order,
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    title="Edit publication"
                    className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void deletePublication(pub.id)}
                    title="Delete publication"
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {pub.abstract && <p className="text-xs text-slate-300 line-clamp-3">{pub.abstract}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {pub.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.07] text-[11px] font-mono text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {pub.paper_url && (
                  <a
                    href={pub.paper_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    Open Paper <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
