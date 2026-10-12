import type { Session } from "./client";

export const SESSION_KEY = "common.session.v1";
const SESSION_EVENT = "common:session";
const SIGN_IN_AGAIN = "Your session ended. Sign in again.";
let refreshing: Promise<Session | null> | null = null;

function claims(token: string): { exp?: number; sub?: string } {
  try {
    return JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
  } catch {
    return {};
  }
}
export function sessionExpiry(session: Session) {
  const exp = claims(session.access_token).exp;
  // JWT expiry takes precedence over estimates in older saved sessions.
  return exp || session.expires_at || 0;
}
export function storedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return value?.access_token && value?.refresh_token && value?.user?.id
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveSession(session: Session) {
  const value = {
    ...session,
    expires_at:
      claims(session.access_token).exp ||
      session.expires_at ||
      Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(SESSION_EVENT));
  return value;
}
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export function subscribeSession(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
export async function refreshSession(
  force = false,
  failedToken?: string,
): Promise<Session | null> {
  if (refreshing) return refreshing;
  const perform = async () => {
    const current = storedSession();
    if (!current) return null;
    // A different request or browser tab may already have rotated this token.
    if (
      (!force || (failedToken && current.access_token !== failedToken)) &&
      sessionExpiry(current) * 1000 > Date.now() + 60000
    )
      return current;
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refresh",
        refresh_token: current.refresh_token,
      }),
    });
    const result = (await response.json()) as Partial<Session>;
    const latest = storedSession();
    // Never restore a signed-out account or overwrite a newer login.
    if (!latest || latest.refresh_token !== current.refresh_token)
      return latest;
    if (
      !response.ok ||
      !result?.access_token ||
      !result?.refresh_token ||
      result.user?.id !== current.user.id
    ) {
      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403
      ) {
        clearSession();
        throw new Error(SIGN_IN_AGAIN);
      }
      throw new Error(
        "Could not renew your session. Check your connection and try again.",
      );
    }
    return saveSession(result as Session);
  };
  // Serialize rotating refresh tokens across tabs when Web Locks is available.
  refreshing = (async () => {
    if (typeof navigator !== "undefined" && navigator.locks)
      return await navigator.locks.request("common-session-refresh", perform);
    return await perform();
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
export async function freshToken(requested: string, force = false) {
  const current = storedSession();
  if (!current) throw new Error(SIGN_IN_AGAIN);
  const subject = claims(requested).sub;
  if (requested !== current.access_token && subject !== current.user.id)
    throw new Error(SIGN_IN_AGAIN);
  const session = await refreshSession(force, force ? requested : undefined);
  if (!session || session.user.id !== current.user.id)
    throw new Error(SIGN_IN_AGAIN);
  return session.access_token;
}
export function isExpiredTokenError(message: unknown) {
  return (
    typeof message === "string" &&
    /jwt expired|token (?:has )?expired/i.test(message)
  );
}
export async function authenticatedFetch(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  let accessToken = await freshToken(token);
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + accessToken);
    return fetch(path, { ...init, headers });
  };
  let response = await send();
  if (!response.ok) {
    const data = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown } | null;
    // These responses fail authentication before a mutation is executed.
    if (isExpiredTokenError(data?.error)) {
      accessToken = await freshToken(accessToken, true);
      response = await send();
    }
  }
  return response;
}
