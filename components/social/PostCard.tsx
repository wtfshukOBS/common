"use client";
import { authenticatedFetch } from "@/lib/session";
import { useState, useRef, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Repeat2,
  MoreHorizontal,
  Eye,
  Pin,
  Flag,
  Quote,
  Trash2,
} from "lucide-react";
import type { Session } from "@/lib/client";
import { act, read, count, relative, type Post } from "@/lib/social/client";
import { Avatar, WorldIcon } from "./Shared";
let activeVideo: HTMLVideoElement | null = null;
export default function PostCard({
  post,
  session,
  onAuth,
  onComment,
  onProfile,
  onWorld,
  onCommunity,
  onQuote,
  onChanged,
  onNotice,
}: {
  post: Post;
  session: Session | null;
  onAuth: () => void;
  onComment: (p: Post) => void;
  onProfile: (id: string) => void;
  onWorld: (id: string) => void;
  onCommunity: (id: string) => void;
  onQuote: (id: string) => void;
  onChanged: () => void;
  onNotice: (v: string) => void;
}) {
  const [local, setLocal] = useState({ baseline: post, value: post }),
    [busy, setBusy] = useState(false),
    [gallery, setGallery] = useState(0);
  const root = useRef<HTMLElement>(null),
    video = useRef<HTMLVideoElement>(null),
    seen = useRef(false);
  const value = local.baseline === post ? local.value : post;
  function setValue(next: Post | ((value: Post) => Post)) {
    setLocal({
      baseline: post,
      value: typeof next === "function" ? next(value) : next,
    });
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (post.type !== "poll") return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [post.type]);
  useEffect(() => {
    const element = root.current;
    const playerAtMount = video.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0].isIntersecting;
        if (visible && !seen.current && session) {
          seen.current = true;
          void act("impression", { post_id: post.id }, session).catch(() => {});
        }
        const player = video.current;
        if (player) {
          if (
            visible &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            if (activeVideo && activeVideo !== player) activeVideo.pause();
            activeVideo = player;
            void player.play().catch(() => {});
          } else player.pause();
        }
      },
      { threshold: 0.65 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (playerAtMount && activeVideo === playerAtMount) activeVideo = null;
    };
  }, [post.id, session]);
  async function action(name: string, extra: Record<string, unknown> = {}) {
    if (!session) {
      onAuth();
      return;
    }
    if (busy) return;
    setBusy(true);
    const previous = value;
    if (name === "like")
      setValue((p) => ({
        ...p,
        liked: !p.liked,
        likes: p.likes + (p.liked ? -1 : 1),
      }));
    if (name === "save_post") setValue((p) => ({ ...p, saved: !p.saved }));
    if (name === "repost")
      setValue((p) => ({
        ...p,
        reposted: !p.reposted,
        reposts: p.reposts + (p.reposted ? -1 : 1),
      }));
    try {
      await act(name, { post_id: post.id, ...extra }, session);
      const fresh = await read<Post>("post", { post_id: post.id }, session);
      if (fresh) setValue(fresh);
      else onChanged();
    } catch (e) {
      setValue(previous);
      onNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = location.origin + "/?post=" + post.id;
    try {
      if (navigator.share)
        await navigator.share({ title: post.title || "A post on Common", url });
      else {
        await navigator.clipboard.writeText(url);
        onNotice("Post link copied");
      }
      if (session) await act("share", { post_id: post.id }, session);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        onNotice("Copy this post link: " + url);
    }
  }
  const images = value.media.filter((m) => m.kind === "image"),
    clip = value.media.find((m) => m.kind === "video");
  return (
    <article ref={root} className={"post-card " + value.type}>
      <header>
        <button
          className="post-author"
          onClick={() => onProfile(value.author_id)}
        >
          <Avatar person={value.author} />
          <span>
            <strong>{value.author?.display_name || "Creator"}</strong>
            <small>
              @{value.author?.username || "member"} ·{" "}
              {relative(value.created_at)}
            </small>
          </span>
        </button>
        {session?.user.id !== value.author_id && (
          <button
            className={
              "follow-mini " + (value.author?.following ? "following" : "")
            }
            onClick={() => {
              if (!session) {
                onAuth();
                return;
              }
              void act("follow", { target_id: value.author_id }, session)
                .then(onChanged)
                .catch((e) => onNotice(e.message));
            }}
          >
            {value.author?.following ? "Following" : "Follow"}
          </button>
        )}
        <details className="post-menu">
          <summary aria-label="Post options">
            <MoreHorizontal size={19} />
          </summary>
          <div>
            <button onClick={() => void share()}>
              <Share2 size={14} />
              Copy or share
            </button>
            <button onClick={() => onQuote(value.id)}>
              <Quote size={14} />
              Quote post
            </button>
            <button onClick={() => void action("save_post")}>
              <Bookmark size={14} />
              {value.saved ? "Unsave" : "Save privately"}
            </button>
            {session?.user.id === value.author_id ? (
              <>
                <button onClick={() => void action("pin_post")}>
                  <Pin size={14} />
                  {value.pinned ? "Unpin" : "Pin to profile"}
                </button>
                <button
                  onClick={() => {
                    const body = window.prompt("Edit your post", value.body);
                    if (body !== null) void action("edit_post", { body });
                  }}
                >
                  Edit post
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (window.confirm("Delete this post?"))
                      void action("delete_post");
                  }}
                >
                  <Trash2 size={14} />
                  Delete post
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    const reason = window.prompt(
                      "What happened? Give at least 10 characters.",
                    );
                    if (reason)
                      void action("report_post", {
                        reason,
                        world_id: value.worlds[0]?.id,
                      });
                  }}
                >
                  <Flag size={14} />
                  Report
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (!session) {
                      onAuth();
                      return;
                    }
                    if (window.confirm("Block this creator?"))
                      void authenticatedFetch(
                        "/api/data",
                        session.access_token,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            action: "block",
                            target_user: value.author_id,
                          }),
                        },
                      )
                        .then((r) => {
                          if (!r.ok) throw new Error("Block failed");
                          onChanged();
                        })
                        .catch((e) => onNotice(e.message));
                  }}
                >
                  Block creator
                </button>
              </>
            )}
          </div>
        </details>
      </header>
      {value.pinned && (
        <p className="pinned-label">
          <Pin size={12} />
          Pinned
        </p>
      )}
      {value.worlds.length > 0 && (
        <div className="post-worlds">
          {value.worlds.map((w) => (
            <button key={w.id} onClick={() => onWorld(w.id)}>
              <WorldIcon name={w.icon} size={12} />
              {w.name}
            </button>
          ))}
        </div>
      )}
      {clip && (
        <div className="post-video">
          <video
            ref={video}
            src={clip.path_url}
            poster={images[0]?.path_url}
            muted
            playsInline
            controls
            loop
            preload="metadata"
            onPlay={(e) => {
              if (activeVideo && activeVideo !== e.currentTarget)
                activeVideo.pause();
              activeVideo = e.currentTarget;
            }}
            onPause={(e) => {
              if (session && e.currentTarget.currentTime > 0)
                void act(
                  "impression",
                  {
                    post_id: value.id,
                    watch_seconds: Math.min(180, e.currentTarget.currentTime),
                  },
                  session,
                ).catch(() => {});
            }}
            onError={() =>
              onNotice(
                "This video did not load. Refresh the feed to try again.",
              )
            }
          />
          <span className="video-views">
            <Eye size={12} />
            {count(value.views)} views
          </span>
        </div>
      )}
      {value.type !== "video" && images.length > 0 && (
        <div className="post-gallery">
          <img
            src={images[gallery]?.path_url}
            alt={images[gallery]?.alt || value.title || "Post image"}
            loading="lazy"
          />
          {images.length > 1 && (
            <div>
              <button
                onClick={() =>
                  setGallery((gallery - 1 + images.length) % images.length)
                }
                aria-label="Previous image"
              >
                ‹
              </button>
              <span>
                {gallery + 1}/{images.length}
              </span>
              <button
                onClick={() => setGallery((gallery + 1) % images.length)}
                aria-label="Next image"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
      <div className="post-copy">
        {value.title && <h3>{value.title}</h3>}
        {value.body && <p>{value.body}</p>}
        {value.topics.length > 0 && (
          <div className="post-topics">
            {value.topics.map((t) => (
              <span key={t}>#{t.replaceAll(" ", "")}</span>
            ))}
          </div>
        )}
        {value.community && (
          <button
            className="community-attribution"
            onClick={() => {
              if (value.community) onCommunity(value.community.id);
            }}
          >
            {value.community.name}
          </button>
        )}
        {value.quoted && (
          <button
            className="quoted-post"
            onClick={() =>
              void read<Post>("post", { post_id: value.quoted!.id }, session)
                .then((p) => {
                  if (p) onComment(p);
                })
                .catch((e) => onNotice(e.message))
            }
          >
            <strong>{value.quoted.author?.display_name}</strong>
            <p>{value.quoted.title || value.quoted.body}</p>
          </button>
        )}
        {value.type === "poll" && value.poll_options && (
          <div className="poll-results">
            {value.poll_options.map((option, i) => {
              const votes =
                  value.poll_results.find((r) => r.option === i)?.votes || 0,
                total = value.poll_results.reduce((n, v) => n + v.votes, 0),
                percent = total ? Math.round((votes / total) * 100) : 0;
              return (
                <button
                  key={i}
                  className={value.vote === i ? "selected" : ""}
                  disabled={
                    busy || new Date(value.poll_closes_at || "").getTime() < now
                  }
                  onClick={() => void action("vote", { option_index: i })}
                >
                  <span style={{ width: percent + "%" }} />
                  <strong>{option}</strong>
                  <small>{percent}%</small>
                </button>
              );
            })}
            <small>
              {count(value.poll_results.reduce((n, v) => n + v.votes, 0))} votes
              · closes {new Date(value.poll_closes_at!).toLocaleDateString()}
            </small>
          </div>
        )}
      </div>
      <footer className="post-interactions">
        <button
          className={value.liked ? "liked" : ""}
          aria-label={value.liked ? "Unlike" : "Like"}
          disabled={busy}
          onClick={() => void action("like")}
        >
          <Heart size={18} fill={value.liked ? "currentColor" : "none"} />
          <span>{count(value.likes)}</span>
        </button>
        <button aria-label="Comments" onClick={() => onComment(value)}>
          <MessageCircle size={18} />
          <span>{count(value.comments)}</span>
        </button>
        <button
          className={value.reposted ? "selected" : ""}
          aria-label="Repost"
          onClick={() => void action("repost")}
        >
          <Repeat2 size={18} />
          <span>{count(value.reposts)}</span>
        </button>
        <button aria-label="Share post" onClick={() => void share()}>
          <Share2 size={17} />
          <span>{count(value.shares)}</span>
        </button>
        <button
          className={value.saved ? "saved" : ""}
          aria-label={value.saved ? "Unsave post" : "Save post"}
          onClick={() => void action("save_post")}
        >
          <Bookmark size={18} fill={value.saved ? "currentColor" : "none"} />
        </button>
      </footer>
    </article>
  );
}
