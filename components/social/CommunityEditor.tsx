"use client";
import { useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/client";
import { act, type World } from "@/lib/social/client";
export default function CommunityEditor({
  session,
  worlds,
  onClose,
  onCreated,
}: {
  session: Session;
  worlds: World[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState("public"),
    [approval, setApproval] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await act<{ id: string }>(
        "create_community",
        {
          name,
          description,
          visibility,
          approval_required: approval,
          world_ids: selected,
        },
        session,
      );
      onCreated(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Create a community" onClose={onClose}>
      <form className="social-form" onSubmit={save}>
        <label>
          Name
          <input
            value={name}
            minLength={3}
            maxLength={60}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            rows={4}
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          Access
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">Public</option>
            <option value="private">Invitation only</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={approval}
            onChange={(e) => setApproval(e.target.checked)}
          />
          Approve new members
        </label>
        <fieldset>
          <legend>Related Worlds</legend>
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
                </label>
              ))}
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Creating…" : "Create community"}
        </button>
      </form>
    </Modal>
  );
}
