"use client";
import { useState, useEffect } from "react";
import {
  Eye,
  Heart,
  Users,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react";
import type { Session } from "@/lib/client";
import { read, count, type Post } from "@/lib/social/client";
type Stats = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followers: number;
  profile_visits: number;
  top_posts: Post[];
  growth: { day: string; followers: number }[];
  distribution: { world: string; posts: number }[];
};
export default function Analytics({
  session,
  onPost,
}: {
  session: Session;
  onPost: (p: Post) => void;
}) {
  const [days, setDays] = useState(30),
    [stats, setStats] = useState<Stats | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void read<Stats>("analytics", { days }, session)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [days, session]);
  return (
    <div className="analytics">
      <div className="section-head">
        <h2>Creator dashboard</h2>
        <select
          aria-label="Analytics date range"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[7, 30, 90].map((n) => (
            <option key={n} value={n}>
              Last {n} days
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {stats && (
        <>
          <div className="stat-grid">
            {[
              { key: "views", label: "Views", icon: Eye },
              { key: "followers", label: "Followers", icon: Users },
              { key: "likes", label: "Likes", icon: Heart },
              { key: "comments", label: "Comments", icon: MessageCircle },
              { key: "shares", label: "Shares", icon: Share2 },
              { key: "saves", label: "Saves", icon: Bookmark },
            ].map(({ key, label, icon: Icon }) => (
              <article key={key}>
                <Icon size={19} />
                <strong>{count(stats[key as keyof Stats] as number)}</strong>
                <small>{label}</small>
              </article>
            ))}
          </div>
          <div className="analytics-grid">
            <section className="panel">
              <h3>Top posts</h3>
              {stats.top_posts.length ? (
                stats.top_posts.map((p) => (
                  <button
                    className="analytics-post"
                    key={p.id}
                    onClick={() => onPost(p)}
                  >
                    <strong>
                      {p.title || p.body.slice(0, 65) || p.type + " post"}
                    </strong>
                    <span>{count(p.views)} views</span>
                  </button>
                ))
              ) : (
                <p className="hint">
                  Publish your first post to start collecting activity.
                </p>
              )}
            </section>
            <section className="panel">
              <h3>World distribution</h3>
              {stats.distribution.length ? (
                stats.distribution.map((d) => (
                  <div className="distribution-row" key={d.world}>
                    <span>{d.world}</span>
                    <strong>{d.posts} posts</strong>
                  </div>
                ))
              ) : (
                <p className="hint">
                  Share a post to a public World to see its distribution here.
                </p>
              )}
            </section>
            <section className="panel">
              <h3>Follower growth</h3>
              {stats.growth.length ? (
                stats.growth.map((g) => (
                  <div className="distribution-row" key={g.day}>
                    <span>{new Date(g.day).toLocaleDateString()}</span>
                    <strong>+{g.followers}</strong>
                  </div>
                ))
              ) : (
                <p className="hint">
                  Growth appears after people start following you.
                </p>
              )}
            </section>
            <section className="panel">
              <h3>Profile visits</h3>
              <strong className="large-stat">
                {count(stats.profile_visits)}
              </strong>
              <p className="hint">
                Unique signed-in visitors per day. Your own visits do not count.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
