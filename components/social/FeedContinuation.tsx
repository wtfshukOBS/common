"use client";
import { useEffect, useRef } from "react";
export default function FeedContinuation({
  loading,
  hasMore,
  disabled,
  onLoad,
}: {
  loading: boolean;
  hasMore: boolean;
  disabled: boolean;
  onLoad: () => Promise<void>;
}) {
  const sentinel = useRef<HTMLDivElement>(null),
    pending = useRef(false);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || loading || !hasMore || disabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || pending.current) return;
        pending.current = true;
        void onLoad().finally(() => {
          pending.current = false;
        });
      },
      { root: node.closest(".video-feed"), rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, hasMore, disabled, onLoad]);
  return (
    <div ref={sentinel} className="feed-continuation" aria-live="polite">
      {loading ? (
        <span>Loading more posts…</span>
      ) : hasMore ? (
        <button className="secondary" onClick={() => void onLoad()}>
          Load more posts
        </button>
      ) : (
        <span>You’re caught up. Come back for new posts.</span>
      )}
    </div>
  );
}
