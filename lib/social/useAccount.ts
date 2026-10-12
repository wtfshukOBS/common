"use client";
import { useState, useEffect, useCallback } from "react";
import { api, type Session, type Profile } from "@/lib/client";
export function useAccount() {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [ready, setReady] = useState(false),
    [configured, setConfigured] = useState(false),
    [error, setError] = useState("");
  const keepSession = useCallback((s: Session) => {
    const next = {
      ...s,
      expires_at:
        s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    };
    localStorage.setItem("common.session.v1", JSON.stringify(next));
    setSession(next);
  }, []);
  const load = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const r = await api<{ items: Profile[] }>(
        "/api/data?kind=profile",
        session.access_token,
      );
      setProfile(r.items[0] || null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);
  useEffect(() => {
    void api<{ configured: boolean }>("/api/config")
      .then((c) => setConfigured(c.configured))
      .catch((e) => setError(e.message));
    // Restore browser-owned state after hydration, without changing the server render.
    void Promise.resolve().then(() => {
      try {
        const stored = JSON.parse(localStorage.getItem("common.session.v1") || "null");
        if (stored?.access_token && stored?.refresh_token) setSession(stored);
      } catch { localStorage.removeItem("common.session.v1"); }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        void api<Session>("/api/auth", undefined, {
          action: "refresh",
          refresh_token: session.refresh_token,
        })
          .then(keepSession)
          .catch(() => {
            setSession(null);
            setProfile(null);
            localStorage.removeItem("common.session.v1");
            setError("Your session ended. Sign in again.");
          });
      },
      Math.max(0, (session.expires_at || 0) * 1000 - Date.now() - 60000),
    );
    return () => clearTimeout(timer);
  }, [session, keepSession]);
  async function logout() {
    if (session)
      await api("/api/auth", session.access_token, { action: "logout" });
    setSession(null);
    setProfile(null);
    localStorage.removeItem("common.session.v1");
  }
  return {
    session,
    profile,
    ready,
    configured,
    error,
    setError,
    keepSession,
    reloadProfile: load,
    logout,
  };
}
