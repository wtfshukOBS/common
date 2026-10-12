"use client";
import { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import { api, type Session } from "@/lib/client";
export default function SettingsPanel({
  session,
  onClose,
  onLogout,
  onDeleted,
  onNotice,
}: {
  session: Session | null;
  onClose: () => void;
  onLogout: () => void;
  onDeleted: () => void;
  onNotice: (s: string) => void;
}) {
  const [theme, setTheme] = useState("dark"),
    [prefs, setPrefs] = useState({
      personalization: true,
      notifications_enabled: true,
      read_receipts: false,
      messages_from: "following",
    }),
    [error, setError] = useState("");
  useEffect(() => {
    void Promise.resolve().then(()=>setTheme(localStorage.getItem("common.theme.v1") || "dark"));
    if (session)
      void api("/api/data?kind=settings", session.access_token)
        .then((r) => {
          if (r.items[0]) setPrefs(r.items[0]);
        })
        .catch((e) => setError(e.message));
  }, [session]);
  async function change(k: string, v: unknown) {
    if (k === "theme") {
      setTheme(String(v));
      localStorage.setItem("common.theme.v1", String(v));
      document.documentElement.dataset.theme =
        v === "system"
          ? window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark"
          : String(v);
    } else setPrefs((p) => ({ ...p, [k]: v }));
    if (session)
      try {
        await api("/api/data", session.access_token, {
          action: "settings",
          settings: { [k]: v },
        });
        onNotice("Preferences saved");
      } catch (e) {
        setError((e as Error).message);
      }
  }
  async function exportData() {
    if (!session) return;
    try {
      const r = await api("/api/data", session.access_token, {
        action: "export",
      });
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "common-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (
      !session ||
      window.prompt(
        "This permanently deletes your Common account and content. Type DELETE to continue.",
      ) !== "DELETE"
    )
      return;
    try {
      const r = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
          "x-confirm-delete": "DELETE",
        },
        body: JSON.stringify({ action: "delete_account" }),
      });
      if (!r.ok) throw new Error("Account deletion failed. Try again.");
      localStorage.removeItem("common.session.v1");
      onDeleted();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Your preferences" onClose={onClose}>
      <div className="social-form">
        <label>
          Appearance
          <select
            value={theme}
            onChange={(e) => void change("theme", e.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </label>
        {session && (
          <>
            <label>
              Who sends you messages
              <select
                value={prefs.messages_from}
                onChange={(e) => void change("messages_from", e.target.value)}
              >
                <option value="anyone">Anyone</option>
                <option value="following">People I follow</option>
                <option value="connections">My mutual connections</option>
                <option value="nobody">Nobody</option>
              </select>
            </label>
            {[
              { key: "personalization", label: "Personalized recommendations" },
              { key: "notifications_enabled", label: "Activity notifications" },
              { key: "read_receipts", label: "Share message read receipts" },
            ].map(({ key, label }) => (
              <label className="setting-row" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(prefs[key as keyof typeof prefs])}
                  onChange={(e) => void change(key, e.target.checked)}
                />
              </label>
            ))}
            <button className="secondary" onClick={() => void exportData()}>
              Export my data
            </button>
            <button className="secondary" onClick={onLogout}>
              Sign out
            </button>
            <button
              className="text-button danger"
              onClick={() => void remove()}
            >
              Delete account
            </button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </Modal>
  );
}
