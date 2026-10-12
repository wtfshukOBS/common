"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  Video,
  ImagePlus,
  AlignLeft,
  ChartNoAxesColumn,
  Upload,
  Plus,
  X,
  Check,
  Globe,
} from "lucide-react";
import Modal from "@/components/Modal";
import {
  act,
  upload,
  thumbnail,
  type World,
  type Community,
  type Media,
} from "@/lib/social/client";
import { postSchema, topics } from "@/lib/social/validation";
import type { Session } from "@/lib/client";
export default function Composer({
  session,
  worlds,
  communities,
  onClose,
  onCreated,
  worldId,
  communityId,
  quotedPostId,
  initialTopics,
}: {
  session: Session;
  worlds: World[];
  communities: Community[];
  onClose: () => void;
  onCreated: (id: string) => void;
  worldId?: string;
  communityId?: string;
  quotedPostId?: string;
  initialTopics?:string[];
}) {
  const [type, setType] = useState<"video" | "image" | "text" | "poll">("text"),
    [body, setBody] = useState(""),
    [title, setTitle] = useState(""),
    [selected, setSelected] = useState<string[]>(worldId ? [worldId] : []),
    [tags, setTags] = useState<string[]>(initialTopics||[]),
    [visibility, setVisibility] = useState("public"),
    [community, setCommunity] = useState(communityId || ""),
    [media, setMedia] = useState<(Media & { preview: string })[]>([]),
    [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [options, setOptions] = useState(["", ""]),
    [closes, setCloses] = useState("");
  const previewRefs = useRef<string[]>([]);
  useEffect(
    () => () => {
      previewRefs.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  async function add(files: FileList | null) {
    if (!files) return;
    setError("");
    setProgress(0);
    try {
      const added: (Media & { preview: string })[] = [];
      for (const f of Array.from(files)) {
        if (type === "video" && f.type !== "video/mp4")
          throw new Error("Choose an MP4 video.");
        if (type === "image" && !f.type.startsWith("image/"))
          throw new Error("Choose images for an image post.");
        const result = await upload(f, session, setProgress);
        added.push({
          ...result,
          preview: (() => {
            const url = URL.createObjectURL(f);
            previewRefs.current.push(url);
            return url;
          })(),
        });
        if (result.kind === "video") {
          const thumb = await thumbnail(f);
          if (thumb) {
            const cover = await upload(thumb, session, setProgress);
            added.push({
              ...cover,
              preview: (() => {
                const url = URL.createObjectURL(thumb);
                previewRefs.current.push(url);
                return url;
              })(),
            });
          }
        }
      }
      setMedia((prev) => [...prev, ...added].slice(0, 8));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = postSchema.parse({
        type,
        title,
        body,
        visibility,
        topics: tags,
        world_ids: selected,
        community_id: community || null,
        quoted_post_id: quotedPostId || null,
        media: media.map((m) => ({ id: m.id, alt: m.alt })),
        ...(type === "poll"
          ? {
              poll_options: options,
              poll_closes_at: closes
                ? new Date(closes).toISOString()
                : undefined,
            }
          : {}),
      });
      const r = await act<{ id: string }>("create_post", payload, session);
      onCreated(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={quotedPostId ? "Quote this post" : "Share something in common."}
      onClose={onClose}
      wide
    >
      <form className="social-form" onSubmit={submit}>
        <div className="composer-types">
          {[
            { type: "text", icon: AlignLeft, label: "Text" },
            { type: "image", icon: ImagePlus, label: "Images" },
            { type: "video", icon: Video, label: "Video" },
            { type: "poll", icon: ChartNoAxesColumn, label: "Poll" },
          ].map(({ type: t, icon: Icon, label }) => (
            <button
              type="button"
              key={t}
              className={type === t ? "active" : ""}
              onClick={() => {
                setType(t as typeof type);
                setMedia([]);
              }}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
        <label>
          {type === "poll" ? "Question" : "Title, optional"}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required={type === "poll"}
            placeholder={
              type === "poll"
                ? "What do you want to ask?"
                : "Give it a little context"
            }
          />
        </label>
        <label>
          {type === "poll"
            ? "More context, optional"
            : type === "text"
              ? "Your post"
              : "Caption"}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={12000}
            rows={5}
            placeholder="What’s on your mind?"
          />
        </label>
        {type === "poll" ? (
          <>
            <div className="poll-options-editor">
              {options.map((v, i) => (
                <label key={i}>
                  Option {i + 1}
                  <input
                    value={v}
                    maxLength={100}
                    onChange={(e) =>
                      setOptions(
                        options.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    required
                  />
                </label>
              ))}
            </div>
            {options.length < 6 && (
              <button
                type="button"
                className="text-button"
                onClick={() => setOptions([...options, ""])}
              >
                <Plus size={14} />
                Add option
              </button>
            )}
            <label>
              Closes at
              <input
                type="datetime-local"
                value={closes}
                required
                onChange={(e) => setCloses(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="upload-zone">
              <Upload size={22} />
              <strong>
                {type === "video"
                  ? "Upload an MP4, up to 3 minutes"
                  : "Add photos"}
              </strong>
              <small>
                {type === "video"
                  ? "Up to 100 MB. Thumbnail created automatically."
                  : "PNG, JPEG or WebP. Up to 10 MB each."}
              </small>
              <input
                type="file"
                accept={
                  type === "video"
                    ? "video/mp4"
                    : "image/png,image/jpeg,image/webp"
                }
                multiple={type !== "video"}
                onChange={(e) => void add(e.target.files)}
                disabled={progress !== null}
              />
            </label>
            {progress !== null && (
              <div className="upload-progress">
                <progress value={progress} max={100} />
                <span>
                  {progress < 95 ? "Uploading" : "Validating"} {progress}%
                </span>
              </div>
            )}
            <div className="media-previews">
              {media.map((m) => (
                <div key={m.id}>
                  {m.kind === "video" ? (
                    <video src={m.preview} muted controls />
                  ) : (
                    <img src={m.preview} alt="" />
                  )}
                  <button
                    type="button"
                    aria-label="Remove attachment"
                    onClick={() => setMedia(media.filter((x) => x.id !== m.id))}
                  >
                    <X size={14} />
                  </button>
                  {m.kind === "image" && (
                    <input
                      value={m.alt}
                      onChange={(e) =>
                        setMedia(
                          media.map((x) =>
                            x.id === m.id ? { ...x, alt: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="Describe this image"
                      maxLength={500}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="form-grid">
          <label>
            Visibility
            <select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value);
                if (e.target.value !== "public") setSelected([]);
              }}
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Only me</option>
            </select>
          </label>
          <label>
            Community
            <select
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
            >
              <option value="">No community</option>
              {communities
                .filter((c) => c.membership === "active")
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Topics, up to five</legend>
          <div className="topic-picker">
            {topics.map((t) => (
              <button
                type="button"
                className={tags.includes(t) ? "selected" : ""}
                onClick={() =>
                  setTags(
                    tags.includes(t)
                      ? tags.filter((x) => x !== t)
                      : tags.length < 5
                        ? [...tags, t]
                        : tags,
                  )
                }
                key={t}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        {visibility === "public" && (
          <fieldset>
            <legend>One post. Many Worlds.</legend>
            <p className="hint">
              All likes, replies and saves stay with your original post.
            </p>
            <div className="world-checkboxes">
              {worlds
                .filter((w) => w.kind === "public")
                .map((w) => (
                  <label key={w.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(w.id)}
                      onChange={() =>
                        setSelected(
                          selected.includes(w.id)
                            ? selected.filter((x) => x !== w.id)
                            : [...selected, w.id],
                        )
                      }
                    />
                    {w.name}
                    {w.contribution === "approval" && (
                      <small>Approval required</small>
                    )}
                  </label>
                ))}
            </div>
            {!worlds.some((w) => w.kind === "public") && (
              <p className="hint">
                Your post will appear in the public feed. Create or join a World
                to share it there too.
              </p>
            )}
          </fieldset>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer className="composer-footer">
          <span>
            <Globe size={14} />
            Your voice. Your audience.
          </span>
          <button className="primary" disabled={busy || progress !== null}>
            {busy ? "Publishing…" : "Publish post"}
            <Check size={16} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
