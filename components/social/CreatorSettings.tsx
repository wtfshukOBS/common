"use client";
import { useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/client";
import { act, upload, type Creator } from "@/lib/social/client";
export default function CreatorSettings({
  session,
  profile,
  onClose,
  onSaved,
}: {
  session: Session;
  profile: Creator;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accent, setAccent] = useState(profile.accent || "#7954ff"),
    [layout, setLayout] = useState(profile.layout || "grid"),
    [visibility, setVisibility] = useState(profile.visibility || "public"),
    [links, setLinks] = useState(
      Object.entries(profile.social_links || {})
        .map(([k, v]) => k + " " + v)
        .join("\n"),
    ),
    [avatar, setAvatar] = useState(profile.avatar_path || null),
    [banner, setBanner] = useState(profile.banner_path || null),
    [progress, setProgress] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function image(file: File, which: string) {
    setProgress(0);
    try {
      const r = await upload(file, session, setProgress);
      if (which === "avatar") setAvatar(r.path);
      else setBanner(r.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const socials = Object.fromEntries(
        links
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const i = line.indexOf(" ");
            if (i < 0)
              throw new Error("Use one label and HTTPS link on each line.");
            return [line.slice(0, i), line.slice(i + 1).trim()];
          }),
      );
      await act(
        "profile_customize",
        {
          accent,
          layout,
          visibility,
          social_links: socials,
          avatar_path: avatar,
          banner_path: banner,
        },
        session,
      );
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Make your profile yours" onClose={onClose}>
      <form className="social-form" onSubmit={save}>
        <div className="form-grid">
          <label>
            Accent
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            />
          </label>
          <label>
            Post layout
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as typeof layout)}
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </label>
        </div>
        <label>
          Avatar
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              if (e.target.files?.[0]) void image(e.target.files[0], "avatar");
            }}
          />
        </label>
        <label>
          Banner
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              if (e.target.files?.[0]) void image(e.target.files[0], "banner");
            }}
          />
        </label>
        {progress !== null && <progress value={progress} max={100} />}
        <label>
          Account visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="public">Public</option>
            <option value="private">Private, approved followers</option>
          </select>
        </label>
        <label>
          Social links
          <textarea
            rows={3}
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder={
              "YouTube https://youtube.com/@yourname\nWebsite https://example.com"
            }
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || progress !== null}>
          {busy ? "Saving…" : "Save profile appearance"}
        </button>
      </form>
    </Modal>
  );
}
