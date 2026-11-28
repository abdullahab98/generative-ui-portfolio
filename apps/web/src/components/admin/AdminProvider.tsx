'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminFetch } from '@/lib/api';

export type ToastItem = {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
};

type ToastApi = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

type AdminContextValue = {
  token: string | null;
  checkingAuth: boolean;
  userEmail: string | null;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  uploadAsset: (file: File, folder: string) => Promise<string>;
  signOut: () => Promise<void>;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  toast: ToastApi;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const dismissToast = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (type: ToastItem['type'], message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
      const timeout = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, type === 'error' ? 4800 : 3600);
      timersRef.current.set(id, timeout);
    },
    [],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message: string, title?: string) => pushToast('success', message, title ?? 'Success'),
      error: (message: string, title?: string) => pushToast('error', message, title ?? 'Error'),
      info: (message: string, title?: string) => pushToast('info', message, title ?? 'Info'),
    }),
    [pushToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const refreshUnreadCount = useCallback(async (jwtOverride?: string) => {
    const jwt = jwtOverride || tokenRef.current;
    if (!jwt) return;
    try {
      const overview = await adminFetch<{ unreadMessagesCount: number }>('/overview', jwt);
      setUnreadCount(overview.unreadMessagesCount ?? 0);
    } catch {
      // ignore background count refresh errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        setCheckingAuth(false);
        router.replace('/admin/login');
        return;
      }
      setToken(data.session.access_token);
      setUserEmail(data.session.user.email ?? null);
      setCheckingAuth(false);
      void refreshUnreadCount(data.session.access_token);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setToken(null);
        setUserEmail(null);
        router.replace('/admin/login');
        return;
      }
      setToken(session.access_token);
      setUserEmail(session.user.email ?? null);
    });

    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [router, refreshUnreadCount]);

  const uploadAsset = useCallback(
    async (file: File, folder: string): Promise<string> => {
      if (!token) throw new Error('Not authenticated');
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${folder}/${Date.now()}-${cleanName}`;
      const { signedUrl, publicUrl } = await adminFetch<{ signedUrl: string; publicUrl: string }>(
        '/upload-url',
        token,
        { method: 'POST', body: JSON.stringify({ path }) },
      );
      const up = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!up.ok) throw new Error('Upload failed');
      return publicUrl;
    },
    [token],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  }, [router]);

  return (
    <AdminContext.Provider
      value={{
        token,
        checkingAuth,
        userEmail,
        unreadCount,
        refreshUnreadCount: () => refreshUnreadCount(),
        uploadAsset,
        signOut,
        toasts,
        dismissToast,
        toast,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider');
  return ctx;
}
