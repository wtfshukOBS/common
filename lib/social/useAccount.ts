"use client";
import { useState, useEffect, useCallback } from "react";
import { api, type Session, type Profile } from "@/lib/client";
import {
  storedSession,
  saveSession,
  clearSession,
  refreshSession,
  sessionExpiry,
  subscribeSession,
} from "@/lib/session";
export function useAccount() {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [ready, setReady] = useState(false),
    [configured, setConfigured] = useState(false),
    [error, setError] = useState("");
  const keepSession = useCallback((s: Session) => {
    saveSession(s);
    setError("");
  }, []);
  const load = useCallback(async () => {
    if (!session) return;
    try {
      const r = await api<{ items: Profile[] }>(
        "/api/data?kind=profile",
        session.access_token,
      );
      if (storedSession()?.user.id !== session.user.id) return;
      setProfile(r.items[0] || null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);
  useEffect(() => {
    let active = true;
    // Refresh restored credentials before exposing the session to data loaders.
    const renew = async () => {
      try {
        const restored = await refreshSession();
        if (active) {
          setSession(restored);
          if (!restored) setProfile(null);
          setError("");
        }
      } catch (e) {
        if (active) {
          setSession(null);
          setProfile(null);
          setError((e as Error).message);
        }
      } finally {
        if (active) setReady(true);
      }
    };
    const unsubscribe = subscribeSession(() => {
      if (!active) return;
      const current = storedSession();
      if (!current) {
        setSession(null);
        setProfile(null);
      } else void renew();
    });
    const visible = () => {
      if (document.visibilityState === "visible") void renew();
    };
    window.addEventListener("focus", renew);
    window.addEventListener("online", renew);
    document.addEventListener("visibilitychange", visible);
    void api<{ configured: boolean }>("/api/config")
      .then((c) => {
        if (active) setConfigured(c.configured);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    void renew();
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", renew);
      window.removeEventListener("online", renew);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        void refreshSession().catch((e) => setError(e.message));
      },
      Math.max(0, sessionExpiry(session) * 1000 - Date.now() - 60000),
    );
    return () => clearTimeout(timer);
  }, [session]);
  async function logout() {
    try {
      if (session)
        await api("/api/auth", session.access_token, { action: "logout" });
    } finally {
      clearSession();
      setSession(null);
      setProfile(null);
    }
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
