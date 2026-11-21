'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Sparkles } from 'lucide-react';
import { resolveSkillIconUrl, type PortfolioUiState, type Skill, type SkillCategory } from '@portfolio/shared';
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

const EMPTY_SKILL = {
  name: '',
  category: 'Frontend' as SkillCategory,
  level: 'Advanced',
  icon_key: 'code',
  proficiency: 85,
  sort_order: 0,
  is_visible: true,
};

export default function AdminSkillsPage() {
  const { token, toast } = useAdmin();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingUi, setSyncingUi] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_SKILL);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const sortSkills = (list: Skill[]) => [...list].sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminFetch<Skill[]>('/skills', token)
      .then((data) => {
        if (active) setSkills(sortSkills(data));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load skills');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function saveSkill(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setNotice('');
    const cleanIconKey = form.icon_key.trim() || form.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'code';
    const payload = {
      ...form,
      icon_key: cleanIconKey,
      proficiency: Number(form.proficiency),
      sort_order: editingId ? Number(form.sort_order) : Number(form.sort_order) || skills.length + 1,
    };
    try {
      if (editingId) {
        const updated = await adminFetch<Skill>(`/skills/${editingId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSkills(sortSkills(skills.map((s) => (s.id === editingId ? updated : s))));
        setEditingId(null);
        setNotice(`Updated "${updated.name}" in database.`);
        toast.success(`Updated "${updated.name}" in database.`, 'Skill Updated');
      } else {
        const created = await adminFetch<Skill>('/skills', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSkills(sortSkills([...skills, created]));
        setNotice(`Added "${created.name}" to database.`);
        toast.success(`Added "${created.name}" to database.`, 'Skill Added');
      }
      setForm(EMPTY_SKILL);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save skill';
      setError(msg);
      toast.error(msg, 'Skill Error');
    }
  }

  async function toggleVisible(s: Skill) {
    if (!token) return;
    try {
      const updated = await adminFetch<Skill>(`/skills/${s.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ is_visible: !s.is_visible }),
      });
      setSkills(sortSkills(skills.map((x) => (x.id === s.id ? updated : x))));
      toast.info(`"${updated.name}" is now ${updated.is_visible ? 'visible' : 'hidden'}.`, 'Visibility Updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Toggle failed';
      setError(msg);
      toast.error(msg);
    }
  }

  async function deleteSkill(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/skills/${id}`, token, { method: 'DELETE' });
      setSkills(skills.filter((s) => s.id !== id));
      setNotice('Skill deleted from database.');
      toast.success('Skill deleted from database.', 'Skill Deleted');
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
        const msg = `Synced all skills into live AI UI (Gen #${updated.epoch_number} · ${updated.theme.name}).`;
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

  if (loading) return <LoadingPanel label="Loading skills..." />;

  const previewIconUrl = resolveSkillIconUrl(form.name || 'code', form.icon_key);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills & Tech Stack"
        description="Full database edit access for skills (name, category, level, icon key, proficiency, order, visibility)."
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
        <form onSubmit={saveSkill} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3.5 items-end">
          <label className="space-y-1 text-xs lg:col-span-2">
            <span className="text-slate-400 font-mono">Skill Name</span>
            <input
              required
              placeholder="e.g. TypeScript, Docker, Next.js"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm({
                  ...form,
                  name,
                  icon_key: editingId ? form.icon_key : name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'code',
                });
              }}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs lg:col-span-2">
            <span className="text-slate-400 font-mono">Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as SkillCategory })}
              className={inputClass}
            >
              <option value="Frontend">Frontend</option>
              <option value="Backend & Architecture">Backend &amp; Architecture</option>
              <option value="Data & AI">Data &amp; AI</option>
              <option value="Tools & DevOps">Tools &amp; DevOps</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Level</span>
            <input
              required
              placeholder="Advanced"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 font-mono">Proficiency ({form.proficiency}%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.proficiency}
              onChange={(e) => setForm({ ...form, proficiency: Number(e.target.value) })}
              className={inputClass}
            />
          </label>

          <label className="space-y-1 text-xs lg:col-span-2">
            <span className="text-slate-400 font-mono">Icon Key (live preview)</span>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-[#070a12] flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewIconUrl} alt="preview" className="w-5 h-5 object-contain" />
              </div>
              <input
                value={form.icon_key}
                onChange={(e) => setForm({ ...form, icon_key: e.target.value })}
                placeholder="react, nextjs, python..."
                className={inputClass}
              />
            </div>
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

          <label className="flex items-center gap-2 text-xs font-mono text-slate-300 h-10">
            <input
              type="checkbox"
              checked={form.is_visible}
              onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
              className="w-4 h-4 accent-cyan-400 cursor-pointer"
            />
            <span>Visible</span>
          </label>

          <div className="lg:col-span-2 flex gap-2">
            <button className={`${btnPrimary} flex-1`}>
              <Plus className="w-4 h-4" /> {editingId ? 'Update Skill' : 'Add Skill'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_SKILL);
                }}
                className={btnSecondary}
                title="Cancel edit"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </Card>

      {skills.length === 0 ? (
        <EmptyState title="No skills added yet" subtitle="Use the form above to add your first skill." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {skills.map((s) => {
            const iconUrl = resolveSkillIconUrl(s.name, s.icon_key);
            const isNext = /next/i.test(s.name + s.icon_key);
            return (
              <div
                key={s.id}
                className={`rounded-2xl border p-4 transition space-y-3 ${
                  s.is_visible
                    ? 'border-white/[0.08] bg-white/[0.025] hover:border-cyan-400/30'
                    : 'border-white/[0.05] bg-white/[0.01] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl border border-white/10 bg-[#070a12] flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={iconUrl}
                        alt={s.name}
                        className={`w-5 h-5 object-contain ${isNext ? 'bg-white rounded-full p-0.5' : ''}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white truncate">{s.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        #{s.sort_order} · {s.category}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => void toggleVisible(s)}
                      title={s.is_visible ? 'Hide skill' : 'Show skill'}
                      className="text-slate-400 hover:text-cyan-400 cursor-pointer"
                    >
                      {s.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(s.id);
                        setForm({
                          name: s.name,
                          category: s.category,
                          level: s.level,
                          icon_key: s.icon_key,
                          proficiency: s.proficiency,
                          sort_order: s.sort_order,
                          is_visible: s.is_visible,
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      title="Edit skill"
                      className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void deleteSkill(s.id)}
                      title="Delete skill"
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      {s.level} · <span className="text-slate-500">{s.icon_key}</span>
                    </span>
                    <span>{s.proficiency}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-300"
                      style={{ width: `${s.proficiency}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
