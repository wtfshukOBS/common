"use client";
import { useState, useEffect } from "react";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/client";
import { read, type Creator } from "@/lib/social/client";
import { Avatar } from "./Shared";
export default function MemberPicker({
  session,
  onClose,
  onSelect,
}: {
  session: Session;
  onClose: () => void;
  onSelect: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [people, setPeople] = useState<Creator[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      void read<{ creators: Creator[] }>("search", { query }, session)
        .then((r) =>
          setPeople(r.creators.filter((p) => p.id !== session.user.id)),
        )
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, session]);
  return (
    <Modal title="Invite a member" onClose={onClose}>
      <div className="social-form">
        <label>
          Find a person
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or username"
          />
        </label>
        <div className="people-picker">
          {people.map((p) => (
            <div className="person-row" key={p.id}>
              <Avatar person={p} />
              <div>
                <strong>{p.display_name}</strong>
                <small>@{p.username}</small>
              </div>
              <button
                className="primary small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSelect(p.id);
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Invite
              </button>
            </div>
          ))}
        </div>
        {!people.length && <p className="hint">No people match this search.</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </Modal>
  );
}
