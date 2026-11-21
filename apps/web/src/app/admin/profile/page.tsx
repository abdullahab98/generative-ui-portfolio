'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Save, Upload, ExternalLink } from 'lucide-react';
import type { SiteProfile } from '@portfolio/shared';
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

export default function AdminProfilePage() {
  const { token, uploadAsset, toast } = useAdmin();
  const [profile, setProfile] = useState<SiteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    adminFetch<SiteProfile>('/profile', token)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load profile');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token || !profile) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await adminFetch<SiteProfile>('/profile', token, {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      setProfile(updated);
      setNotice('Profile saved and live site cache refreshed.');
      toast.success('Profile saved and live site cache refreshed.', 'Profile Updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
      toast.error(msg, 'Save Failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) return <LoadingPanel label="Loading profile..." />;

  const fields = [
    ['name', 'Full Name'],
    ['brand_name', 'Navbar Brand'],
    ['tagline', 'Tagline'],
    ['headline', 'Hero Headline'],
    ['location', 'Location'],
    ['availability_status', 'Availability Status'],
    ['email', 'Contact Email'],
    ['github_url', 'GitHub URL'],
    ['linkedin_url', 'LinkedIn URL'],
    ['resume_url', 'Resume PDF URL'],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile & Identity"
        description="Manage your public headline, bio, social links, and downloadable resume."
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
        <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-5">
          {fields.map(([key, label]) => (
            <label key={key} className="space-y-1.5 text-xs">
              <span className="text-slate-300 font-mono">{label}</span>
              <input
                value={profile[key]}
                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                className={inputClass}
              />
            </label>
          ))}

          <div className="sm:col-span-2 rounded-xl border border-dashed border-white/15 bg-[#070a12] p-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-xs font-mono text-slate-300 cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-cyan-400/15 text-cyan-300 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-200">
                  {uploading ? 'Uploading Resume PDF...' : 'Upload Resume PDF'}
                </div>
                <div className="text-[11px] text-slate-500">Uploads to Supabase Storage &amp; fills Resume URL</div>
              </div>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setError('');
                  try {
                    const url = await uploadAsset(file, 'resume');
                    setProfile({ ...profile, resume_url: url });
                    setNotice('Resume uploaded! Click "Save Profile" to publish.');
                    toast.success('Resume uploaded! Click "Save Profile" to publish.', 'Resume Uploaded');
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

            {profile.resume_url && (
              <a
                href={profile.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline"
              >
                Preview Resume <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <label className="sm:col-span-2 space-y-1.5 text-xs">
            <span className="text-slate-300 font-mono">Subheadline</span>
            <input
              value={profile.subheadline}
              onChange={(e) => setProfile({ ...profile, subheadline: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="sm:col-span-2 space-y-1.5 text-xs">
            <span className="text-slate-300 font-mono">Bio</span>
            <textarea
              rows={4}
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className={inputClass}
            />
          </label>

          <div className="sm:col-span-2 pt-2">
            <button disabled={saving} className={btnPrimary}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
