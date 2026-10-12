"use client";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Modal from "./Modal";
import { api, type Session } from "@/lib/client";
import { authenticatedFetch } from "@/lib/session";
import { categories, momentSchema } from "@/lib/validation";
export default function CreateMoment({
  session,
  onClose,
  onCreated,
  initialCategory = "Gaming",
  worldId,
  communityId,
}: {
  session: Session;
  onClose: () => void;
  onCreated: (id: string) => void;
  initialCategory?: string;
  worldId?: string;
  communityId?: string;
}) {
  const [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(""),
    [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: initialCategory,
    tags: "",
    cover: "gaming",
    schedule: "now",
    occurrences: 4,
    date: "",
    time: "",
    duration_minutes: 60,
    capacity: 6,
    language: "English",
    voice: "optional",
    visibility: "public",
    approval_required: false,
    meeting_url: "",
  });
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/upload", session.access_token, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });
      const data = (await r.json()) as { path: string; error: string };
      if (!r.ok) throw new Error(data.error);
      update("cover", data.path);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (step < 3) {
      if (
        step === 0 &&
        (!draft.title.trim() || draft.description.trim().length < 10)
      ) {
        setError("Add a title and a description of at least 10 characters.");
        return;
      }
      if (
        step === 1 &&
        draft.schedule !== "now" &&
        (!draft.date || !draft.time)
      ) {
        setError("Choose a date and time.");
        return;
      }
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const start =
        draft.schedule === "now"
          ? new Date()
          : new Date(draft.date + "T" + draft.time);
      if (
        !Number.isFinite(start.getTime()) ||
        (draft.schedule !== "now" && start.getTime() < Date.now())
      )
        throw new Error("Choose a future date and time.");
      const moment = momentSchema.parse({
        ...draft,
        ...(worldId ? { world_id: worldId } : {}),
        ...(communityId ? { community_id: communityId } : {}),
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        start_at: start.toISOString(),
        status: draft.schedule === "now" ? "live" : "scheduled",
        occurrences: draft.schedule === "repeat" ? draft.occurrences : 1,
      });
      const result = await api("/api/data", session.access_token, {
        action: "create",
        moment,
      });
      onCreated(result.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Create a Moment" onClose={onClose} wide>
      <div className="create-layout">
        <aside className="steps">
          {["The idea", "Date & time", "Your group", "Ready to meet"].map(
            (v, i) => (
              <div
                className={step === i ? "current" : step > i ? "done" : ""}
                key={v}
              >
                <span>{step > i ? <Check size={15} /> : i + 1}</span>
                <div>
                  <strong>{v}</strong>
                  <small>
                    {
                      [
                        "Tell us what you’re doing",
                        "Now, or something to look forward to",
                        "Make everyone feel at home",
                        "One last look",
                      ][i]
                    }
                  </small>
                </div>
              </div>
            ),
          )}
        </aside>
        <form className="form" onSubmit={submit}>
          <div className="step-content">
            {step === 0 ? (
              <>
                <p className="eyebrow">START WITH SOMETHING YOU LOVE</p>
                <label>
                  Moment title
                  <input
                    autoFocus
                    value={draft.title}
                    onChange={(e) => update("title", e.target.value)}
                    maxLength={100}
                    placeholder="A few rounds and a good conversation"
                    required
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={draft.description}
                    onChange={(e) => update("description", e.target.value)}
                    maxLength={3000}
                    rows={4}
                    placeholder="What are you doing? Who would enjoy joining?"
                    required
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Category
                    <select
                      value={draft.category}
                      onChange={(e) => update("category", e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tags, separated by commas
                    <input
                      value={draft.tags}
                      onChange={(e) => update("tags", e.target.value)}
                      placeholder="Co-op, casual"
                    />
                  </label>
                </div>
                <label>Cover</label>
                <div className="cover-picker">
                  {["gaming", "movies", "art"].map((c) => (
                    <button
                      type="button"
                      className={draft.cover === c ? "selected" : ""}
                      onClick={() => update("cover", c)}
                      key={c}
                      aria-label={"Choose " + c + " cover"}
                    >
                      <img src={"/covers/" + c + ".webp"} alt="" />
                      {draft.cover === c && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <label>
                  Or upload your own cover
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                    }}
                  />
                </label>
                {uploading && <p className="hint">Uploading cover…</p>}
                {preview && draft.cover.includes("/") && (
                  <img
                    className="review-cover"
                    src={preview}
                    alt="Your cover"
                  />
                )}
              </>
            ) : step === 1 ? (
              <>
                <p className="eyebrow">MAKE A LITTLE TIME FOR PEOPLE</p>
                <h3>When are you meeting?</h3>
                <div className="segmented">
                  <button
                    type="button"
                    className={draft.schedule === "now" ? "active" : ""}
                    onClick={() => update("schedule", "now")}
                  >
                    Start now
                  </button>
                  <button
                    type="button"
                    className={draft.schedule !== "now" ? "active" : ""}
                    onClick={() => update("schedule", "later")}
                  >
                    Schedule for later
                  </button>
                  <button
                    type="button"
                    className={draft.schedule === "repeat" ? "active" : ""}
                    onClick={() => update("schedule", "repeat")}
                  >
                    Weekly series
                  </button>
                </div>
                {draft.schedule !== "now" && (
                  <div className="field-grid">
                    <label>
                      Date
                      <input
                        type="date"
                        value={draft.date}
                        onChange={(e) => update("date", e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Time
                      <input
                        type="time"
                        value={draft.time}
                        onChange={(e) => update("time", e.target.value)}
                        required
                      />
                    </label>
                  </div>
                )}
                {draft.schedule === "repeat" && (
                  <label>
                    Number of weekly Moments
                    <select
                      value={draft.occurrences}
                      onChange={(e) =>
                        update("occurrences", Number(e.target.value))
                      }
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option value={n} key={n}>
                          {n} weekly Moments
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Duration
                  <select
                    value={draft.duration_minutes}
                    onChange={(e) =>
                      update("duration_minutes", Number(e.target.value))
                    }
                  >
                    {[30, 60, 90, 120, 180].map((n) => (
                      <option value={n} key={n}>
                        {n} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <p className="hint">
                  Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                  Everyone sees their local time.
                </p>
              </>
            ) : step === 2 ? (
              <>
                <p className="eyebrow">A GROUP THAT FEELS RIGHT</p>
                <div className="field-grid">
                  <label>
                    Group size, including you
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={draft.capacity}
                      onChange={(e) =>
                        update("capacity", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Language
                    <input
                      value={draft.language}
                      onChange={(e) => update("language", e.target.value)}
                      maxLength={40}
                      required
                    />
                  </label>
                  <label>
                    Visibility
                    <select
                      value={draft.visibility}
                      onChange={(e) => update("visibility", e.target.value)}
                    >
                      <option value="public">Public, open to everyone</option>
                      <option value="private">Private, invitation only</option>
                    </select>
                  </label>
                  <label>
                    Voice preference
                    <select
                      value={draft.voice}
                      onChange={(e) => update("voice", e.target.value)}
                    >
                      <option value="optional">Voice optional</option>
                      <option value="required">Voice encouraged</option>
                      <option value="text">Text chat</option>
                    </select>
                  </label>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.approval_required}
                    onChange={(e) =>
                      update("approval_required", e.target.checked)
                    }
                  />
                  Approve join requests
                </label>
                <label>
                  Meeting or game link, optional
                  <input
                    type="url"
                    value={draft.meeting_url}
                    onChange={(e) => update("meeting_url", e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <p className="hint">
                  Common provides group text chat. Use your own meeting link for
                  video or voice.
                </p>
              </>
            ) : (
              <>
                <img
                  className="review-cover"
                  src={
                    draft.cover.includes("/")
                      ? preview
                      : "/covers/" + draft.cover + ".webp"
                  }
                  alt=""
                />
                <p className="eyebrow">YOUR MOMENT</p>
                <h3>{draft.title}</h3>
                <p>{draft.description}</p>
                <div className="chips">
                  <span>{draft.category}</span>
                  <span>{draft.capacity} people</span>
                  <span>{draft.duration_minutes} min</span>
                  <span>{draft.visibility}</span>
                </div>
                <p className="hint">
                  {draft.schedule === "now"
                    ? "Starts as soon as you create it."
                    : draft.date + " at " + draft.time}
                </p>
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <footer className="form-actions">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="secondary"
              >
                <ArrowLeft size={15} />
                Back
              </button>
            )}
            <button className="primary" disabled={busy || uploading}>
              {busy ? "Creating…" : step === 3 ? "Create Moment" : "Continue"}
              <ArrowRight size={15} />
            </button>
          </footer>
        </form>
      </div>
    </Modal>
  );
}
