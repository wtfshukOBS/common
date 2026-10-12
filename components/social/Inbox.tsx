"use client";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Plus, Send, BellOff, MoreHorizontal } from "lucide-react";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/client";
import { read, act, relative, type Creator } from "@/lib/social/client";
import { Avatar, Empty } from "./Shared";
type Conversation = {
  id: string;
  title: string;
  members: Creator[];
  unread: number;
  muted: boolean;
  last_message?: { body: string; created_at: string };
};
type Message = {
  id: string;
  author_id: string;
  author: Creator;
  body: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
};
export default function Inbox({
  session,
  initialId,
  onAuth,
}: {
  session: Session | null;
  initialId?: string | null;
  onNotice: (v: string) => void;
  onAuth: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState<string | null>(initialId || null),
    [messages, setMessages] = useState<Message[]>([]),
    [receipts, setReceipts] = useState<
      { user: Creator; read_at: string | null }[]
    >([]),
    [body, setBody] = useState(""),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState(""),
    [people, setPeople] = useState<Creator[]>([]),
    [chosen, setChosen] = useState<string[]>([]),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  const load = useCallback(async () => {
    if (!session) return;
    try {
      setConversations(
        await read<Conversation[]>("conversations", {}, session),
      );
      if (selected) {
        const r = await read<{
          messages: Message[];
          members: { user: Creator; read_at: string | null }[];
        }>("conversation", { conversation_id: selected }, session);
        setMessages(r.messages);
        setReceipts(r.members);
        setMore(r.messages.length === 50);
        await act("read_conversation", { conversation_id: selected }, session);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session, selected]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!session || !selected) return;
    let stop = () => {},
      cancelled = false;
    void (async () => {
      const cfg = (await fetch("/api/config").then((r) => r.json())) as {
        url: string;
        key: string;
      };
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const client = createClient(cfg.url, cfg.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await client.realtime.setAuth(session.access_token);
      const ch = client
        .channel("dm-" + selected)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "direct_messages",
            filter: "conversation_id=eq." + selected,
          },
          () => void load(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") void load();
        });
      stop = () => {
        void client.removeChannel(ch);
      };
    })().catch(() =>
      setError(
        "Chat connection interrupted. Reopen the conversation to reconnect.",
      ),
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [session, selected, load]);
  useEffect(() => {
    if (!create || !session) return;
    const timer = setTimeout(() => {
      void read<{ creators: Creator[] }>("search", { query: search }, session)
        .then((r) =>
          setPeople(r.creators.filter((p) => p.id !== session.user.id)),
        )
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, create, session]);
  async function start(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    try {
      const r = await act<{ id: string }>(
        "create_conversation",
        { members: chosen, title },
        session,
      );
      setSelected(r.id);
      setCreate(false);
      setChosen([]);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!session || !selected) return;
    setBusy(true);
    try {
      await act(
        "send_dm",
        { conversation_id: selected, body: body.trim() },
        session,
      );
      setBody("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = conversations.find((c) => c.id === selected);
  if (!session)
    return (
      <Empty
        title="Conversations start with a connection."
        text="Sign in to message creators and keep your conversations private."
        action={onAuth}
        label="Sign in"
      />
    );
  return (
    <>
      <div className="inbox-layout">
        <aside>
          <header>
            <h3>Inbox</h3>
            <button
              className="icon-button"
              aria-label="New conversation"
              onClick={() => setCreate(true)}
            >
              <Plus size={20} />
            </button>
          </header>
          {conversations.length === 0 && (
            <p className="hint">No conversations yet.</p>
          )}
          {conversations.map((c) => (
            <button
              className={
                "conversation-row " + (selected === c.id ? "selected" : "")
              }
              onClick={() => setSelected(c.id)}
              key={c.id}
            >
              <Avatar
                person={
                  c.members.find((p) => p.id !== session.user.id) ||
                  c.members[0]
                }
              />
              <span>
                <strong>
                  {c.title ||
                    c.members
                      .filter((p) => p.id !== session.user.id)
                      .map((p) => p.display_name)
                      .join(", ")}
                </strong>
                <small>{c.last_message?.body || "Say hello"}</small>
              </span>
              {c.unread > 0 && <i>{c.unread}</i>}
            </button>
          ))}
        </aside>
        <section className="dm-pane">
          {selected ? (
            <>
              <header>
                <div>
                  <h3>
                    {active?.title ||
                      active?.members
                        .filter((p) => p.id !== session.user.id)
                        .map((p) => p.display_name)
                        .join(", ") ||
                      "Conversation"}
                  </h3>
                  <small>
                    {active?.members.length || 0} people · private conversation
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Mute conversation"
                  onClick={() =>
                    void act(
                      "mute_conversation",
                      { conversation_id: selected },
                      session,
                    ).then(load)
                  }
                >
                  <BellOff size={18} />
                </button>
              </header>
              <div className="dm-messages">
                {more && (
                  <button
                    className="text-button"
                    onClick={async () => {
                      const r = await read<{
                        messages: Message[];
                        members: { user: Creator; read_at: string | null }[];
                      }>(
                        "conversation",
                        {
                          conversation_id: selected,
                          before: messages[0]?.created_at,
                        },
                        session,
                      );
                      setMessages([...r.messages, ...messages]);
                      setMore(r.messages.length === 50);
                    }}
                  >
                    Load older messages
                  </button>
                )}
                {messages.map((m) => (
                  <div
                    className={
                      "dm-message " +
                      (m.author_id === session.user.id ? "own" : "")
                    }
                    key={m.id}
                  >
                    <Avatar person={m.author} />
                    <div>
                      <strong>
                        {m.author?.display_name}
                        <small>
                          {relative(m.created_at)}
                          {m.edited_at ? " · edited" : ""}
                        </small>
                      </strong>
                      <p>{m.body}</p>
                      {m.author_id === session.user.id &&
                        receipts.some(
                          (r) =>
                            r.user.id !== session.user.id &&
                            r.read_at &&
                            new Date(r.read_at) >= new Date(m.created_at),
                        ) && <small>Seen</small>}
                    </div>
                    {m.author_id === session.user.id && !m.deleted_at && (
                      <details>
                        <summary aria-label="Message options">
                          <MoreHorizontal size={16} />
                        </summary>
                        <button
                          onClick={() => {
                            const text = window.prompt(
                              "Edit your message",
                              m.body,
                            );
                            if (text)
                              void act(
                                "edit_dm",
                                {
                                  conversation_id: selected,
                                  message_id: m.id,
                                  body: text,
                                },
                                session,
                              )
                                .then(load)
                                .catch((e) => setError(e.message));
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            void act(
                              "delete_dm",
                              { conversation_id: selected, message_id: m.id },
                              session,
                            )
                              .then(load)
                              .catch((e) => setError(e.message))
                          }
                        >
                          Delete
                        </button>
                      </details>
                    )}
                  </div>
                ))}
              </div>
              <form className="comment-composer" onSubmit={send}>
                <input
                  aria-label="Write a message"
                  value={body}
                  maxLength={3000}
                  required
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                />
                <button className="primary" disabled={busy || !body.trim()}>
                  <Send size={17} />
                </button>
              </form>
            </>
          ) : (
            <Empty
              title="A little more conversation."
              text="Choose a conversation or send your first message."
              action={() => setCreate(true)}
              label="New message"
            />
          )}
        </section>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {create && (
        <Modal title="New conversation" onClose={() => setCreate(false)}>
          <form className="social-form" onSubmit={start}>
            <label>
              Find people
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or username"
              />
            </label>
            <div className="people-picker">
              {people.map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(p.id)}
                    onChange={() =>
                      setChosen(
                        chosen.includes(p.id)
                          ? chosen.filter((x) => x !== p.id)
                          : [...chosen, p.id],
                      )
                    }
                  />
                  <Avatar person={p} />
                  <span>
                    {p.display_name}
                    <small>@{p.username}</small>
                  </span>
                </label>
              ))}
            </div>
            {chosen.length > 1 && (
              <label>
                Group name
                <input
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            )}
            <p className="hint">
              Everyone’s messaging permissions apply. Choose who contacts you in
              Settings.
            </p>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={busy || !chosen.length}>
              Start conversation
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
