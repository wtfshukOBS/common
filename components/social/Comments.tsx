"use client";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Send, CornerDownRight, X } from "lucide-react";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/client";
import {
  act,
  read,
  relative,
  type Post,
  type Creator,
} from "@/lib/social/client";
import { Avatar } from "./Shared";
type Comment = {
  id: string;
  author_id: string;
  author: Creator;
  body: string;
  parent_id: string | null;
  created_at: string;
  deleted_at: string | null;
};
export default function Comments({
  post,
  session,
  onClose,
  onAuth,
  onChanged,
}: {
  post: Post;
  session: Session | null;
  onClose: () => void;
  onAuth: () => void;
  onChanged: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]),
    [body, setBody] = useState(""),
    [reply, setReply] = useState<Comment | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hasMore, setHasMore] = useState(false);
  const load = useCallback(async (before?: string) => {
    try {
      const items = await read<Comment[]>(
        "comments",
        { post_id: post.id, before },
        session,
      );
      setComments((v) => (before ? [...items, ...v] : items));
      setHasMore(items.length === 80);
    } catch (e) {
      setError((e as Error).message);
    }
  },[post.id,session]);
  useEffect(() => {
    void Promise.resolve().then(()=>load());
  }, [load]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!session) {
      onAuth();
      return;
    }
    setBusy(true);
    try {
      await act(
        "comment",
        { post_id: post.id, body: body.trim(), parent_id: reply?.id || null },
        session,
      );
      setBody("");
      setReply(null);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function thread(comment: Comment, depth = 0): React.ReactNode {
    return (
      <div
        className="comment-thread"
        key={comment.id}
        style={{ marginLeft: Math.min(depth, 3) * 13 }}
      >
        <div className="comment">
          <Avatar person={comment.author} />
          <div>
            <strong>{comment.author?.display_name || "Member"}</strong>
            <small>{relative(comment.created_at)}</small>
            <p>{comment.body}</p>
            {!comment.deleted_at && (
              <div>
                <button onClick={() => setReply(comment)}>Reply</button>
                {session?.user.id === comment.author_id && (
                  <button
                    onClick={() =>
                      void act(
                        "delete_comment",
                        { post_id: post.id, comment_id: comment.id },
                        session,
                      )
                        .then(() => load())
                        .then(onChanged)
                        .catch((e) => setError(e.message))
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {depth < 8 &&
          comments
            .filter((c) => c.parent_id === comment.id)
            .map((c) => thread(c, depth + 1))}
      </div>
    );
  }
  return (
    <Modal title="Join the conversation" onClose={onClose} wide>
      <div className="discussion-summary">
        <strong>{post.title || post.author?.display_name + "’s post"}</strong>
        <p>{post.body}</p>
      </div>
      <div className="comments-scroll">
        {hasMore && (
          <button
            className="text-button"
            onClick={() => void load(comments[0]?.created_at)}
          >
            Load older replies
          </button>
        )}
        {comments.length === 0 && (
          <p className="hint">No replies yet. Start the conversation.</p>
        )}
        {comments
          .filter(
            (c) => !c.parent_id || !comments.some((p) => p.id === c.parent_id),
          )
          .map((c) => thread(c))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {reply && (
        <div className="replying">
          <CornerDownRight size={14} />
          Replying to {reply.author?.display_name}
          <button aria-label="Cancel reply" onClick={() => setReply(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      <form className="comment-composer" onSubmit={send}>
        <textarea
          aria-label="Write a reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={3000}
          rows={2}
          required
          placeholder="Add to the conversation…"
        />
        <button className="primary" disabled={busy || !body.trim()}>
          <Send size={16} />
          <span>{busy ? "Sending…" : "Reply"}</span>
        </button>
      </form>
    </Modal>
  );
}
