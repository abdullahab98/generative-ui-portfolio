'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload, ExternalLink, X, Star, Sparkles } from 'lucide-react';
import type { PortfolioUiState, Project } from '@portfolio/shared';
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

const EMPTY_PROJECT = {
  title: '',
  slug: '',
  category: 'Full-Stack',
  filter_group: 'Full-Stack',
  summary: '',
  description: '',
  tech_stack: 'Next.js, TypeScript',
  github_url: '',
  live_url: '',
  image_url: '',
  is_featured: false,
  is_published: true,
  sort_order: 0,
};

export default function AdminProjectsPage() {
  const { token, uploadAsset, toast } = useAdmin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingUi, setSyncingUi] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const sortProjects = (list: Project[]) => [...list].sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminFetch<Project[]>('/projects', token)
      .then((data) => {
        if (active) setProjects(sortProjects(data));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load projects');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function saveProject(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setNotice('');
    const payload = {
      ...form,
      sort_order: editingId ? Number(form.sort_order) : Number(form.sort_order) || projects.length + 1,
      tech_stack: form.tech_stack
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) {
        const updated = await adminFetch<Project>(`/projects/${editingId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setProjects(sortProjects(projects.map((p) => (p.id === editingId ? updated : p))));
        setEditingId(null);
        setNotice(`Updated "${updated.title}" in database.`);
        toast.success(`Updated "${updated.title}" in database.`, 'Project Updated');
      } else {
        const created = await adminFetch<Project>('/projects', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setProjects(sortProjects([...projects, created]));
        setNotice(`Added "${created.title}" to database.`);
        toast.success(`Added "${created.title}" to database.`, 'Project Added');
      }
      setForm(EMPTY_PROJECT);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save project';
      setError(msg);
      toast.error(msg, 'Project Error');
    }
  }

  async function togglePublished(p: Project) {
    if (!token) return;
    try {
      const updated = await adminFetch<Project>(`/projects/${p.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: !p.is_published }),
      });
      setProjects(sortProjects(projects.map((x) => (x.id === p.id ? updated : x))));
      toast.info(`"${updated.title}" marked as ${updated.is_published ? 'Published' : 'Draft'}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Toggle failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function toggleFeatured(p: Project) {
    if (!token) return;
    try {
      const updated = await adminFetch<Project>(`/projects/${p.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ is_featured: !p.is_featured }),
      });
      setProjects(sortProjects(projects.map((x) => (x.id === p.id ? updated : x))));
      toast.info(`"${updated.title}" ${updated.is_featured ? 'marked as Featured' : 'removed from Featured'}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Toggle failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function deleteProject(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/projects/${id}`, token, { method: 'DELETE' });
      setProjects(projects.filter((p) => p.id !== id));
      setNotice('Project deleted from database.');
      toast.success('Project deleted from database.', 'Project Deleted');
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
        const msg = `Synced all projects into live AI UI (Gen #${updated.epoch_number} · ${updated.theme.name}).`;
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

  if (loading) return <LoadingPanel label="Loading projects..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Full database edit access for projects (category, filter group, featured, published, sort order, links, thumbnail)."
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
        <form onSubmit={saveProject} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Project Title</span>
            <input
              required
              placeholder="e.g. University Management System"
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm({
                  ...form,
                  title,
                  slug: editingId
                    ? form.slug
                    : title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                });
              }}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Slug</span>
            <input
              required
              placeholder="project-slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Category</span>
            <input
              required
              placeholder="Full-Stack / AI / Systems"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Filter Group</span>
            <input
              required
              placeholder="Full-Stack, AI & Vision, Tools"
              value={form.filter_group}
              onChange={(e) => setForm({ ...form, filter_group: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs lg:col-span-2">
            <span className="text-slate-400 font-mono">Tech Stack (comma separated)</span>
            <input
              required
              placeholder="Next.js, TypeScript, Supabase"
              value={form.tech_stack}
              onChange={(e) => setForm({ ...form, tech_stack: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2 lg:col-span-3 space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Short Summary</span>
            <input
              required
              placeholder="One-line value proposition"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="sm:col-span-2 lg:col-span-3 space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Description</span>
            <textarea
              required
              rows={3}
              placeholder="Detailed architectural overview..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">GitHub URL</span>
            <input
              placeholder="https://github.com/..."
              value={form.github_url}
              onChange={(e) => setForm({ ...form, github_url: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Live Demo URL</span>
            <input
              placeholder="https://..."
              value={form.live_url}
              onChange={(e) => setForm({ ...form, live_url: e.target.value })}
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
            <span className="text-slate-400 font-mono">Thumbnail Image URL</span>
            <input
              placeholder="https://..."
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#070a12] px-4 py-2.5 text-xs font-mono text-slate-300 cursor-pointer self-end">
            <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{uploading ? 'Uploading...' : 'Upload Thumbnail'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError('');
                try {
                  const url = await uploadAsset(file, 'projects');
                  setForm({ ...form, image_url: url });
                  setNotice('Project thumbnail uploaded!');
                  toast.success('Project thumbnail uploaded!', 'Image Uploaded');
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Upload failed';
                  setError(msg);
                  toast.error(msg, 'Upload Failed');
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>

          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-6 pt-1 text-xs font-mono text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                className="w-4 h-4 accent-amber-400 cursor-pointer"
              />
              <span>Featured Project</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
              <span>Published</span>
            </label>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2 pt-1">
            <button className={btnPrimary}>
              <Plus className="w-4 h-4" /> {editingId ? 'Update Project' : 'Add Project'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_PROJECT);
                }}
                className={btnSecondary}
              >
                <X className="w-4 h-4" /> Cancel Edit
              </button>
            )}
          </div>
        </form>
      </Card>

      {projects.length === 0 ? (
        <EmptyState title="No projects yet" subtitle="Add your first project using the form above." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 space-y-3 transition ${
                p.is_published
                  ? 'border-white/[0.08] bg-white/[0.025] hover:border-cyan-400/30'
                  : 'border-white/[0.05] bg-white/[0.01] opacity-65'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-base text-white truncate">{p.title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        p.is_published ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/20 text-slate-400'
                      }`}
                    >
                      {p.is_published ? 'Published' : 'Draft'}
                    </span>
                    {p.is_featured && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-400/15 text-amber-300">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-cyan-400 mt-0.5">
                    #{p.sort_order} · {p.category} · <span className="text-slate-400">{p.filter_group}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => void toggleFeatured(p)}
                    title={p.is_featured ? 'Unfeature' : 'Mark featured'}
                    className={`cursor-pointer ${p.is_featured ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                  >
                    <Star className="w-4 h-4" fill={p.is_featured ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => void togglePublished(p)}
                    title={p.is_published ? 'Unpublish' : 'Publish'}
                    className="text-slate-400 hover:text-cyan-400 cursor-pointer"
                  >
                    {p.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setForm({
                        title: p.title,
                        slug: p.slug,
                        category: p.category,
                        filter_group: p.filter_group,
                        summary: p.summary,
                        description: p.description,
                        tech_stack: p.tech_stack.join(', '),
                        github_url: p.github_url,
                        live_url: p.live_url,
                        image_url: p.image_url,
                        is_featured: p.is_featured,
                        is_published: p.is_published,
                        sort_order: p.sort_order,
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    title="Edit project"
                    className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void deleteProject(p.id)}
                    title="Delete project"
                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2">{p.summary}</p>

              <div className="flex flex-wrap gap-1.5">
                {p.tech_stack.map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.07] text-[11px] font-mono text-slate-300"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              {(p.github_url || p.live_url) && (
                <div className="flex items-center gap-4 pt-1 text-xs font-mono">
                  {p.github_url && (
                    <a
                      href={p.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white inline-flex items-center gap-1"
                    >
                      GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {p.live_url && (
                    <a
                      href={p.live_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                    >
                      Live Demo <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
