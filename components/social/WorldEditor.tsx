"use client";
import { useState, type FormEvent } from "react";
import { Plus, Lock, Globe } from "lucide-react";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/client";
import { act, upload, type World } from "@/lib/social/client";
import { topics, worldSchema } from "@/lib/social/validation";
import { WorldIcon } from "./Shared";
export default function WorldEditor({
  session,
  world,
  onClose,
  onSaved,
  preset,
}: {
  session: Session;
  world?: World;
  onClose: () => void;
  onSaved: (id: string) => void;
  preset?: string;
}) {
  const [draft, setDraft] = useState({
      name: world?.name || (preset ? preset + " World" : ""),
      description: world?.description || "",
      kind: world?.kind || "personal",
      visibility: world?.visibility || "private",
      category: world?.category || preset || "Gaming",
      topics: world?.topics || [preset || "Gaming"],
      cover: world?.cover || "world-gaming",
      icon: world?.icon || "gamepad",
      content_mix: world?.content_mix || {
        video: 30,
        image: 25,
        text: 25,
        community: 20,
      },
      contribution: world?.contribution || "members",
      rules: world?.rules || "",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<number | null>(null);
  const update = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = worldSchema.parse(draft);
      const r = await act<{ id: string }>(
        world ? "update_world" : "create_world",
        { ...data, ...(world ? { world_id: world.id } : {}) },
        session,
      );
      onSaved(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={world ? "Customize your World" : "Create a World"}
      onClose={onClose}
      wide
    >
      <form className="social-form" onSubmit={save}>
        <p className="hint">Build a space for your interests and community.</p>
        <div className="world-editor-grid">
          <div>
            <label>
              World name
              <input
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
                minLength={3}
                maxLength={50}
                required
                placeholder="Indie Games World"
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                maxLength={1000}
              />
            </label>
            <label>
              World type
              <select
                value={draft.kind}
                disabled={!!world}
                onChange={(e) => {
                  update("kind", e.target.value);
                  update(
                    "visibility",
                    e.target.value === "personal" ? "private" : "public",
                  );
                }}
              >
                <option value="personal">
                  Personal, my private custom feed
                </option>
                <option value="public">Public, a shared space</option>
              </select>
            </label>
            {draft.kind === "public" && (
              <label>
                Access
                <select
                  value={draft.visibility}
                  onChange={(e) => update("visibility", e.target.value)}
                >
                  <option value="public">Discoverable</option>
                  <option value="private">Invitation only</option>
                </select>
              </label>
            )}
            <label>
              Category
              <select
                value={draft.category}
                onChange={(e) => update("category", e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Topics, up to five</legend>
              <div className="topic-picker">
                {topics.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={draft.topics.includes(t) ? "selected" : ""}
                    onClick={() =>
                      update(
                        "topics",
                        draft.topics.includes(t)
                          ? draft.topics.filter((x) => x !== t)
                          : draft.topics.length < 5
                            ? [...draft.topics, t]
                            : draft.topics,
                      )
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div>
            <fieldset>
              <legend>Content mix</legend>
              <p className="hint">Relative preferences, not fixed quotas.</p>
              {Object.entries(draft.content_mix).map(([k, v]) => (
                <label className="mix-slider" key={k}>
                  <span>
                    {k === "text"
                      ? "Discussions"
                      : k === "community"
                        ? "Community posts"
                        : k === "video"
                          ? "Short videos"
                          : "Images"}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={v}
                    onChange={(e) =>
                      update("content_mix", {
                        ...draft.content_mix,
                        [k]: Number(e.target.value),
                      })
                    }
                  />
                  <small>{v}%</small>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Icon</legend>
              <div className="icon-picker">
                {[
                  "gamepad",
                  "music",
                  "camera",
                  "smile",
                  "sparkles",
                  "dumbbell",
                  "palette",
                  "globe",
                ].map((icon) => (
                  <button
                    type="button"
                    aria-label={icon}
                    className={draft.icon === icon ? "selected" : ""}
                    key={icon}
                    onClick={() => update("icon", icon)}
                  >
                    <WorldIcon name={icon} />
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Cover</legend>
              <div className="cover-picker">
                {[
                  "world-gaming",
                  "world-music",
                  "world-creator",
                  "world-comedy",
                ].map((c) => (
                  <button
                    type="button"
                    className={draft.cover === c ? "selected" : ""}
                    key={c}
                    onClick={() => update("cover", c)}
                  >
                    <img
                      src={"/covers/" + c + ".webp"}
                      alt={c.replace("world-", "")}
                    />
                  </button>
                ))}
              </div>
              <label>
                Upload a cover
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setProgress(0);
                    try {
                      const m = await upload(f, session, setProgress);
                      update("cover", m.path);
                    } catch (err) {
                      setError((err as Error).message);
                    } finally {
                      setProgress(null);
                    }
                  }}
                />
              </label>
              {progress !== null && <progress value={progress} max={100} />}
            </fieldset>
          </div>
        </div>
        {draft.kind === "public" && (
          <div className="form-grid">
            <label>
              Contributors
              <select
                value={draft.contribution}
                onChange={(e) => update("contribution", e.target.value)}
              >
                <option value="anyone">Anyone contributes</option>
                <option value="members">Members contribute</option>
                <option value="approval">Moderator approval</option>
                <option value="owner">Owners and moderators</option>
              </select>
            </label>
            <label>
              Rules
              <textarea
                value={draft.rules}
                onChange={(e) => update("rules", e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Be kind. Stay on topic."
              />
            </label>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="composer-footer">
          <span>
            {draft.kind === "personal" ? (
              <Lock size={14} />
            ) : (
              <Globe size={14} />
            )}{" "}
            {draft.kind === "personal"
              ? "Only you see this feed’s preferences."
              : "One shared feed. Original attribution."}
          </span>
          <button className="primary" disabled={busy || progress !== null}>
            {busy ? "Saving…" : world ? "Save World" : "Create World"}
            <Plus size={15} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
