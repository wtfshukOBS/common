"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Home,
  Globe,
  Compass,
  PlusCircle,
  Mail,
  User,
  Search,
  Bell,
  Settings,
  Plus,
  ChevronRight,
  ChevronDown,
  Users,
  CalendarDays,
  BarChart3,
  LogOut,
  Menu,
  ArrowRight,
  ImagePlus,
  Video,
  AlignLeft,
  Bookmark,
  Check,
  Lock,
  Pin,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Auth from "@/components/Auth";
import ProfileEditor from "@/components/ProfileEditor";
import CreateMoment from "@/components/CreateMoment";
import Room from "@/components/Room";
import Composer from "@/components/social/Composer";
import WorldEditor from "@/components/social/WorldEditor";
import CommunityEditor from "@/components/social/CommunityEditor";
import FeedContinuation from "@/components/social/FeedContinuation";
import PostCard from "@/components/social/PostCard";
import Comments from "@/components/social/Comments";
import Inbox from "@/components/social/Inbox";
import CreatorSettings from "@/components/social/CreatorSettings";
import SettingsPanel from "@/components/social/SettingsPanel";
import MemberPicker from "@/components/social/MemberPicker";
import Analytics from "@/components/social/Analytics";
import {
  Avatar,
  WorldIcon,
  WorldCard,
  Empty,
} from "@/components/social/Shared";
import { useAccount } from "@/lib/social/useAccount";
import {
  read,
  act,
  count,
  type Bootstrap,
  type World,
  type Community,
  type Creator,
  type Post,
  type Cursor,
} from "@/lib/social/client";
import { api, dateLabel, coverSource, type Moment } from "@/lib/client";
const primaryNav = [
  { name: "Home", icon: Home },
  { name: "Worlds", icon: Globe },
  { name: "Explore", icon: Compass },
  { name: "Create", icon: PlusCircle },
  { name: "Inbox", icon: Mail },
  { name: "Profile", icon: User },
];
const templates = [
  {
    name: "Gaming",
    cover: "world-gaming",
    icon: "gamepad",
    description: "Games. Clips. Your next obsession.",
  },
  {
    name: "Music",
    cover: "world-music",
    icon: "music",
    description: "New sounds. Artists. Good company.",
  },
  {
    name: "Creators",
    cover: "world-creator",
    icon: "camera",
    description: "Ideas. Behind the scenes. Creator talk.",
  },
  {
    name: "Comedy",
    cover: "world-comedy",
    icon: "smile",
    description: "Memes. Sketches. A little less serious.",
  },
];
type WorldDetail = {
  world: World;
  members: { user: Creator; role: string }[];
  communities: Community[];
  pending: Post[];
  reports: {
    id: string;
    post_id: string;
    reason: string;
    created_at: string;
  }[];
};
type CommunityDetail = {
  community: Community;
  members: { user: Creator; role: string; status: string }[];
};
type ProfileDetail = { profile: Creator; worlds: World[]; requests: Creator[] };
type Notification = {
  id: string;
  title: string;
  moment_id?: string;
  post_id?: string;
  world_id?: string;
  conversation_id?: string;
  actor_id?: string;
  read_at?: string;
  created_at: string;
};
const emptyBoot: Bootstrap = {
  worlds: [],
  creators: [],
  communities: [],
  following_ids: [],
};
export default function Common() {
  const account = useAccount(),
    { session, profile, configured } = account;
  const [page, setPage] = useState("Home"),
    [boot, setBoot] = useState<Bootstrap>(emptyBoot),
    [worldId, setWorldId] = useState<string | null>(null),
    [communityId, setCommunityId] = useState<string | null>(null),
    [profileId, setProfileId] = useState<string | null>(null),
    [worldDetail, setWorldDetail] = useState<WorldDetail | null>(null),
    [communityDetail, setCommunityDetail] = useState<CommunityDetail | null>(
      null,
    ),
    [creatorDetail, setCreatorDetail] = useState<ProfileDetail | null>(null),
    [posts, setPosts] = useState<Post[]>([]),
    [cursor, setCursor] = useState<Cursor | null>(null),
    [tab, setTab] = useState("For You"),
    [sort, setSort] = useState("balanced"),
    [small, setSmall] = useState(true),
    [followedCommunities, setFollowedCommunities] = useState(false),
    [query, setQuery] = useState(""),
    [searchResults, setSearchResults] = useState<Bootstrap>(emptyBoot),
    [modal, setModal] = useState<
      | "auth"
      | "post"
      | "world"
      | "community"
      | "profile"
      | "settings"
      | "customize"
      | "event"
      | null
    >(null),
    [preset, setPreset] = useState<string | undefined>(),
    [editingWorld, setEditingWorld] = useState<World | undefined>(),
    [quotedPost, setQuotedPost] = useState<string | undefined>(),
    [commentPost, setCommentPost] = useState<Post | null>(null),
    [events, setEvents] = useState<Moment[]>([]),
    [room, setRoom] = useState<string | null>(null),
    [inboxId, setInboxId] = useState<string | null>(null),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [notificationOpen, setNotificationOpen] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [onboardingDismissed, setOnboardingDismissed] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [inviteTarget, setInviteTarget] = useState<{
      kind: "world" | "community";
      id: string;
    } | null>(null);
  const alert = useCallback((s: string) => setNotice(s), []);
  const loadBoot = useCallback(async () => {
    try {
      setBoot(await read<Bootstrap>("bootstrap", {}, session));
      if (session) {
        const n = await api<{ items: Notification[] }>(
          "/api/data?kind=notifications",
          session.access_token,
        );
        setNotifications(n.items);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);
  useEffect(() => {
    if (account.ready) void Promise.resolve().then(loadBoot);
  }, [account.ready, loadBoot]);

  useEffect(() => {
    const theme = localStorage.getItem("common.theme.v1") || "dark",
      media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "light" : "dark") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  function navigate(next: string) {
    setPage(next);
    setWorldId(
      next === "Worlds"
        ? boot.worlds.find((w) => w.joined || w.owner_id === session?.user.id)
            ?.id || null
        : null,
    );
    setCommunityId(null);
    setRoom(null);
    setProfileId(next === "Profile" ? session?.user.id || null : null);
    setTab("For You");
    setQuery("");
    setMobileMenu(false);
    history.replaceState(null, "", location.pathname);
  }
  function requireAccount(action: () => void) {
    if (!session) {
      setModal("auth");
      return;
    }
    if (!profile?.onboarded) {
      setModal("profile");
      return;
    }
    action();
  }
  function createPost(quote?: string) {
    requireAccount(() => {
      setQuotedPost(quote);
      setModal("post");
    });
  }
  function openWorld(id: string) {
    setWorldId(id);
    setCommunityId(null);
    setRoom(null);
    setPage("Worlds");
    setTab("For You");
    setQuery("");
    history.replaceState(null, "", "?world=" + id);
  }
  function openCommunity(id: string) {
    setCommunityId(id);
    setWorldId(null);
    setRoom(null);
    setPage("Communities");
    setTab("For You");
    history.replaceState(null, "", "?community=" + id);
  }
  function openProfile(id: string) {
    setProfileId(id);
    setWorldId(null);
    setCommunityId(null);
    setRoom(null);
    setPage("Profile");
    setTab("Posts");
    history.replaceState(null, "", "?profile=" + id);
    if (session && id !== session.user.id)
      void act("visit_profile", { target_id: id }, session).catch(() => {});
  }
  function openComments(post: Post) {
    setCommentPost(post);
    history.replaceState(null, "", "?post=" + post.id);
  }
  async function mutation(action: string, payload: Record<string, unknown>) {
    if (!session) {
      setModal("auth");
      return;
    }
    setBusy(true);
    try {
      await act(action, payload, session);
      await refresh();
      alert("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const feedSequence = useRef(0);
  const loadFeed = useCallback(
    async (more = false, currentCursor: Cursor | null = null) => {
      if (
        ![
          "Home",
          "Worlds",
          "Explore",
          "Profile",
          "Communities",
          "Saved",
        ].includes(page) ||
        [
          "Creators",
          "Communities",
          "Events",
          "Members",
          "Moderation",
          "About",
          "Worlds",
        ].includes(tab)
      )
        return;
      const requestId = ++feedSequence.current;
      setLoading(true);
      if (!more) setPosts([]);
      try {
        const selectedTab =
          page === "Saved"
            ? "Saved"
            : page === "Profile"
              ? tab === "Posts"
                ? "For You"
                : tab
              : tab;
        const r = await read<{ items: Post[]; cursor: Cursor | null }>(
          "feed",
          {
            world_id: worldId,
            community_id: communityId,
            target_id: page === "Profile" ? profileId : null,
            query,
            tab: selectedTab,
            sort: page === "Profile" ? "newest" : sort,
            small_creators: small,
            followed_communities: followedCommunities,
            cursor: more ? currentCursor : undefined,
          },
          session,
        );
        if (requestId !== feedSequence.current) return;
        setPosts((v) =>
          more
            ? [
                ...v,
                ...r.items.filter(
                  (p) => !v.some((existing) => existing.id === p.id),
                ),
              ]
            : r.items,
        );
        setCursor(r.cursor);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (requestId === feedSequence.current) setLoading(false);
      }
    },
    [
      page,
      tab,
      worldId,
      communityId,
      profileId,
      query,
      sort,
      small,
      followedCommunities,
      session,
    ],
  );
  useEffect(() => {
    if (!account.ready) return;
    const timer = setTimeout(() => void loadFeed(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [account.ready, query, loadFeed]);
  const loadContext = useCallback(async () => {
    try {
      if (worldId) {
        const r = await read<WorldDetail>(
          "world",
          { world_id: worldId },
          session,
        );
        setWorldDetail(r);
        if (r.world.preferences) {
          setSort(r.world.preferences.sort);
          setSmall(r.world.preferences.small_creators);
          setFollowedCommunities(r.world.preferences.followed_communities);
        } else {
          setSort("balanced");
          setSmall(true);
          setFollowedCommunities(false);
        }
      }
      if (communityId)
        setCommunityDetail(
          await read<CommunityDetail>(
            "community",
            { community_id: communityId },
            session,
          ),
        );
      if (profileId)
        setCreatorDetail(
          await read<ProfileDetail>(
            "profile",
            { target_id: profileId },
            session,
          ),
        );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [worldId, communityId, profileId, session]);
  useEffect(() => {
    void Promise.resolve().then(loadContext);
  }, [loadContext]);
  const loadEvents = useCallback(async () => {
    if (!session) return;
    try {
      const r = await api<{ items: Moment[] }>(
        "/api/data?kind=moments",
        session.access_token,
      );
      setEvents(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);
  useEffect(() => {
    if (page === "Events" || tab === "Events")
      void Promise.resolve().then(loadEvents);
  }, [page, tab, loadEvents]);
  async function refresh() {
    await Promise.all([loadBoot(), loadContext(), loadFeed()]);
  }
  useEffect(() => {
    if (page !== "Explore") return;
    const timer = setTimeout(() => {
      void read<Bootstrap>("search", { query }, session)
        .then(setSearchResults)
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, page, session]);
  useEffect(() => {
    if (!account.ready) return;
    void Promise.resolve().then(() => {
      const q = new URLSearchParams(location.search);
      if (q.get("world")) openWorld(q.get("world")!);
      else if (q.get("community")) openCommunity(q.get("community")!);
      else if (q.get("profile")) openProfile(q.get("profile")!);
      else if (q.get("post"))
        void read<Post>("post", { post_id: q.get("post") }, session)
          .then((p) => {
            if (p) setCommentPost(p);
          })
          .catch((e) => setError(e.message));
    });
    // Restore the initial URL once; subsequent route changes use navigation handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.ready]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false,
      stop = () => {};
    void (async () => {
      const cfg = await api<{ url: string; key: string }>("/api/config");
      const { createClient } = await import("@supabase/supabase-js");
      if (cancelled) return;
      const c = createClient(cfg.url, cfg.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await c.realtime.setAuth(session.access_token);
      const ch = c
        .channel("common-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: "user_id=eq." + session.user.id,
          },
          () => void loadBoot(),
        )
        .subscribe();
      stop = () => {
        void c.removeChannel(ch);
      };
    })().catch(() => {});
    return () => {
      cancelled = true;
      stop();
    };
  }, [session, loadBoot]);
  async function preference(k: string, v: unknown) {
    const values = {
      sort,
      small_creators: small,
      followed_communities: followedCommunities,
      [k]: v,
    };
    if (k === "sort") setSort(String(v));
    if (k === "small_creators") setSmall(Boolean(v));
    if (k === "followed_communities") setFollowedCommunities(Boolean(v));
    if (worldId && session)
      try {
        await act(
          "world_preferences",
          { world_id: worldId, ...values },
          session,
        );
        await loadContext();
      } catch (e) {
        setError((e as Error).message);
      }
  }
  async function message(id: string) {
    if (!session) {
      setModal("auth");
      return;
    }
    try {
      const r = await act<{ id: string }>(
        "create_conversation",
        { members: [id], title: "" },
        session,
      );
      setInboxId(r.id);
      navigate("Inbox");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const activeWorld = worldId
      ? worldDetail?.world.id === worldId
        ? worldDetail.world
        : boot.worlds.find((w) => w.id === worldId)
      : null,
    activeCommunity = communityId ? communityDetail?.community : null,
    creator =
      creatorDetail?.profile.id === profileId ? creatorDetail.profile : null,
    ownProfile = profileId === session?.user.id;
  const me: Creator = {
    id: profile?.id || "",
    display_name: profile?.display_name || "Your profile",
    username: profile?.username || "new_member",
    bio: profile?.bio || "",
    interests: profile?.interests || [],
    accent: "#7954ff",
    layout: "grid",
    social_links: {},
    visibility: "public",
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    following: false,
    follows_you: false,
  };
  const myWorlds = boot.worlds.filter(
      (w) => w.joined || w.owner_id === session?.user.id,
    ),
    railWorlds = page === "Worlds" ? myWorlds : myWorlds.slice(0, 4);
  const unread = notifications.filter((n) => !n.read_at).length;
  const title =
    page === "Home"
      ? "Your feed. Your people."
      : page === "Worlds"
        ? "Your Worlds"
        : page === "Explore"
          ? "Find your next obsession."
          : page === "Profile"
            ? creator?.display_name || "Your profile"
            : page === "Communities"
              ? "Your communities"
              : page === "Events"
                ? "Events & activities"
                : page === "Saved"
                  ? "Saved posts"
                  : page === "Analytics"
                    ? "Creator dashboard"
                    : "Inbox";
  const visibleEvents = events.filter(
    (m) =>
      (!communityId && !worldId) ||
      (communityId && m.community_id === communityId) ||
      (worldId && m.world_id === worldId),
  );
  function postList() {
    return loading && !posts.length ? (
      <div className="social-skeletons">
        {[1, 2, 3].map((i) => (
          <div key={i} />
        ))}
      </div>
    ) : posts.length ? (
      <>
        <div
          className={
            "social-feed " +
            (tab === "Videos"
              ? "video-feed"
              : page === "Profile" && creator?.layout !== "list"
                ? ""
                : "timeline-feed")
          }
          role={tab === "Videos" ? "region" : undefined}
          aria-label={
            tab === "Videos"
              ? "Short video feed. Scroll or use arrow keys for the next video."
              : "Post timeline"
          }
          tabIndex={tab === "Videos" ? 0 : undefined}
          onKeyDown={(e) => {
            if (
              tab !== "Videos" ||
              e.target !== e.currentTarget ||
              !["ArrowDown", "ArrowUp"].includes(e.key)
            )
              return;
            e.preventDefault();
            e.currentTarget.scrollBy({
              top:
                (e.key === "ArrowDown" ? 1 : -1) * e.currentTarget.clientHeight,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
          }}
        >
          {posts.map((p) => (
            <PostCard
              post={p}
              immersive={tab === "Videos"}
              session={session}
              key={p.id}
              onAuth={() => setModal("auth")}
              onComment={openComments}
              onProfile={openProfile}
              onWorld={openWorld}
              onCommunity={openCommunity}
              onQuote={createPost}
              onChanged={() => void refresh()}
              onNotice={alert}
            />
          ))}
          <FeedContinuation
            loading={loading}
            hasMore={!!cursor}
            disabled={!!error}
            onLoad={() => (cursor ? loadFeed(true, cursor) : Promise.resolve())}
          />
        </div>
      </>
    ) : (
      <Empty
        title={
          query
            ? "No posts match your search."
            : tab === "Videos"
              ? "No videos here yet."
              : activeWorld
                ? "Your World starts with you."
                : "Make the first post worth coming back for."
        }
        text={
          tab === "Videos"
            ? "Share a short video. Scroll or swipe to move between clips as they arrive."
            : activeWorld?.kind === "personal"
              ? "Follow creators or broaden your topics to fill this feed."
              : "Share a clip, a photo, a thought. Keep it original."
        }
        action={() => createPost()}
        label="Create a post"
      />
    );
  }
  function peopleList(people: Creator[]) {
    return (
      <div className="creator-grid">
        {people.filter(Boolean).map((p) => (
          <article className="creator-tile" key={p.id}>
            <button onClick={() => openProfile(p.id)}>
              <Avatar person={p} size="large" />
              <h3>{p.display_name}</h3>
              <small>@{p.username}</small>
              <p>{p.bio}</p>
            </button>
            <span>{count(p.follower_count)} followers</span>
            <button
              className="primary small"
              onClick={() => void mutation("follow", { target_id: p.id })}
            >
              {p.following ? "Following" : "Follow"}
            </button>
          </article>
        ))}
      </div>
    );
  }
  function communityList(items: Community[]) {
    return (
      <div className="community-grid">
        {items.map((c) => (
          <article className="community-card" key={c.id}>
            <span className="world-symbol">
              <Users size={22} />
            </span>
            <div>
              <button
                className="card-title"
                onClick={() => openCommunity(c.id)}
              >
                {c.name}
              </button>
              <small>{count(c.member_count)} members</small>
              <p>{c.description}</p>
            </div>
            <button
              className="secondary small"
              onClick={() =>
                void mutation(
                  c.membership === "active"
                    ? "leave_community"
                    : "join_community",
                  { community_id: c.id },
                )
              }
            >
              {c.membership === "active"
                ? "Joined"
                : c.membership === "pending"
                  ? "Requested"
                  : "Join"}
            </button>
          </article>
        ))}
      </div>
    );
  }
  function eventList() {
    return (
      <>
        <div className="section-head">
          <h2>
            {activeCommunity
              ? "Community Events"
              : activeWorld
                ? "World Events"
                : "Your Events"}
          </h2>
          <button
            className="primary small"
            onClick={() => requireAccount(() => setModal("event"))}
          >
            <Plus size={16} />
            Host an Event
          </button>
        </div>
        {!session ? (
          <Empty
            title="A little more time together."
            text="Sign in to join activities and revisit your Moments."
            action={() => setModal("auth")}
            label="Sign in"
          />
        ) : visibleEvents.length ? (
          <div className="event-grid">
            {visibleEvents.map((m) => (
              <button
                className="event-card"
                key={m.id}
                onClick={() => setRoom(m.id)}
              >
                <img src={coverSource(m)} alt="" />
                <span className={"status " + m.status}>{m.status}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p>{dateLabel(m.start_at)}</p>
                  <small>
                    {m.participants.length}/{m.capacity} people · {m.category}
                  </small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="A shared experience belongs here too."
            text="Host a game, a watch party, or a conversation. Your original Moments remain available here."
            action={() => setModal("event")}
            label="Host an Event"
          />
        )}
      </>
    );
  }
  return (
    <div className="social-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={"social-sidebar " + (mobileMenu ? "mobile-open" : "")}>
        <button className="brand" onClick={() => navigate("Home")}>
          common<span>.</span>
        </button>
        <p className="brand-tagline">
          Your feed. Your interests. Your community.
        </p>
        <nav aria-label="Primary navigation">
          {primaryNav.map(({ name, icon: Icon }) => (
            <button
              className={page === name ? "active" : ""}
              key={name}
              onClick={() =>
                name === "Create"
                  ? createPost()
                  : name === "Profile"
                    ? session
                      ? openProfile(session.user.id)
                      : setModal("auth")
                    : navigate(name)
              }
            >
              <Icon size={20} />
              <span>{name}</span>
              {name === "Inbox" && unread > 0 && <i>{unread}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-pitch">
          <Globe size={24} />
          <h3>
            One post.
            <br />
            Many Worlds.
          </h3>
          <p>
            Share your post across Worlds. Keep your audience and every
            conversation in one place.
          </p>
          <button onClick={() => navigate("Worlds")}>
            Find your World
            <ArrowRight size={15} />
          </button>
        </div>
        <footer>
          <button
            className="sidebar-user"
            onClick={() =>
              session ? openProfile(session.user.id) : setModal("auth")
            }
          >
            <Avatar person={creator && ownProfile ? creator : me} />
            <span>
              <strong>{session ? me.display_name : "Join Common"}</strong>
              <small>
                {session ? "@" + me.username : "Make yourself at home"}
              </small>
            </span>
          </button>
          <details className="account-menu">
            <summary aria-label="Account menu">
              <ChevronDown size={16} />
            </summary>
            <div>
              <button onClick={() => setModal("settings")}>
                <Settings size={15} />
                Settings
              </button>
              <button onClick={() => navigate("Communities")}>
                <Users size={15} />
                Communities
              </button>
              <button onClick={() => navigate("Events")}>
                <CalendarDays size={15} />
                Events & activities
              </button>
              <button onClick={() => navigate("Saved")}>
                <Bookmark size={15} />
                Saved posts
              </button>
              <button
                onClick={() =>
                  session ? navigate("Analytics") : setModal("auth")
                }
              >
                <BarChart3 size={15} />
                Creator dashboard
              </button>
              {session && (
                <button
                  onClick={() =>
                    void account
                      .logout()
                      .then(() => navigate("Home"))
                      .catch((e) => setError(e.message))
                  }
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              )}
            </div>
          </details>
        </footer>
      </aside>
      <div className="social-workspace">
        <header className="social-topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <Menu size={20} />
          </button>
          <button
            className="brand mobile-brand"
            onClick={() => navigate("Home")}
          >
            common<span>.</span>
          </button>
          <label className="search">
            <Search size={17} />
            <input
              value={query}
              aria-label="Search Common"
              onChange={(e) => {
                setQuery(e.target.value);
                if (page !== "Explore") {
                  setPage("Explore");
                  setWorldId(null);
                  setCommunityId(null);
                  setProfileId(null);
                }
              }}
              placeholder="Search for people, Worlds, or topics…"
            />
          </label>
          <div>
            <button className="top-create" onClick={() => createPost()}>
              <Plus size={16} />
              Create post
            </button>
            <div className="notification-wrapper">
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() =>
                  session
                    ? setNotificationOpen(!notificationOpen)
                    : setModal("auth")
                }
              >
                <Bell size={20} />
                {unread > 0 && <i className="notification-dot" />}
              </button>
              {notificationOpen && (
                <div className="notification-menu">
                  <header>
                    <h3>Notifications</h3>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (session)
                          void api("/api/data", session.access_token, {
                            action: "read_notifications",
                          }).then(loadBoot);
                      }}
                    >
                      Mark all read
                    </button>
                  </header>
                  {notifications.length ? (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotificationOpen(false);
                          if (n.post_id)
                            void read<Post>(
                              "post",
                              { post_id: n.post_id },
                              session,
                            ).then((p) => {
                              if (p) openComments(p);
                            });
                          else if (n.world_id) openWorld(n.world_id);
                          else if (n.conversation_id) {
                            setInboxId(n.conversation_id);
                            navigate("Inbox");
                          } else if (n.moment_id) {
                            navigate("Events");
                            setRoom(n.moment_id);
                          } else if (n.actor_id) openProfile(n.actor_id);
                        }}
                      >
                        <strong>{n.title}</strong>
                        <small>{dateLabel(n.created_at)}</small>
                      </button>
                    ))
                  ) : (
                    <p className="hint">You’re all caught up.</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="top-avatar"
              aria-label="Your profile"
              onClick={() =>
                session ? openProfile(session.user.id) : setModal("auth")
              }
            >
              <Avatar person={me} />
            </button>
          </div>
        </header>
        <div
          className={
            "social-content " +
            (tab === "Videos" ? "shorts-mode " : "") +
            (["Inbox", "Events"].includes(page) || room ? "wide-content" : "")
          }
        >
          <main id="main" aria-busy={busy || loading}>
            {(error || account.error) && (
              <div className="error-banner" role="alert">
                <p>{error || account.error}</p>
                <button
                  onClick={() => {
                    setError("");
                    account.setError("");
                    void refresh();
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {room && session ? (
              <Room
                id={room}
                session={session}
                onBack={() => setRoom(null)}
                onChanged={() => void loadEvents()}
                onNotice={alert}
              />
            ) : (
              <>
                <div className="social-page-heading">
                  <div>
                    <h1>{title}</h1>
                    <p>
                      {page === "Worlds"
                        ? "Customizable feeds for everything you’re into."
                        : page === "Home"
                          ? "Videos, photos, and conversations that feel like you."
                          : page === "Explore"
                            ? "New creators. Shared interests. Something worth finding."
                            : page === "Communities"
                              ? "Smaller groups. Ongoing conversations. Shared interests."
                              : page === "Events"
                                ? "Your original Moments, now part of a bigger Common."
                                : page === "Profile"
                                  ? ""
                                  : page === "Inbox"
                                    ? "Keep your conversations going."
                                    : "Your corner of Common."}
                    </p>
                  </div>
                  {page === "Worlds" && (
                    <button
                      className="primary"
                      onClick={() =>
                        requireAccount(() => {
                          setEditingWorld(undefined);
                          setPreset(undefined);
                          setModal("world");
                        })
                      }
                    >
                      <Plus size={17} />
                      Create a World
                    </button>
                  )}
                  {page === "Communities" && !communityId && (
                    <button
                      className="primary"
                      onClick={() =>
                        requireAccount(() => setModal("community"))
                      }
                    >
                      <Plus size={17} />
                      New community
                    </button>
                  )}
                </div>
                {page === "Inbox" ? (
                  <Inbox
                    key={inboxId || "inbox"}
                    session={session}
                    initialId={inboxId}
                    onNotice={alert}
                    onAuth={() => setModal("auth")}
                  />
                ) : page === "Analytics" && session ? (
                  <Analytics session={session} onPost={openComments} />
                ) : page === "Events" ? (
                  eventList()
                ) : (
                  <>
                    {(page === "Home" || page === "Worlds") && (
                      <section className="world-rail" aria-label="Your Worlds">
                        {railWorlds.length
                          ? railWorlds.map((w) => (
                              <WorldCard
                                key={w.id}
                                world={w}
                                selected={worldId === w.id}
                                onClick={() => openWorld(w.id)}
                              />
                            ))
                          : templates.map((t) => (
                              <button
                                className="world-card template"
                                key={t.name}
                                onClick={() =>
                                  requireAccount(() => {
                                    setEditingWorld(undefined);
                                    setPreset(t.name);
                                    setModal("world");
                                  })
                                }
                              >
                                <img
                                  src={"/covers/" + t.cover + ".webp"}
                                  alt=""
                                />
                                <div className="world-shade" />
                                <div className="world-card-content">
                                  <span className={"world-symbol " + t.icon}>
                                    <WorldIcon name={t.icon} size={22} />
                                  </span>
                                  <strong>{t.name} World</strong>
                                  <small>{t.description}</small>
                                  <span className="world-card-meta">
                                    <Plus size={11} />
                                    Create your own
                                  </span>
                                </div>
                              </button>
                            ))}
                      </section>
                    )}
                    {page === "Home" && (
                      <button
                        className="inline-composer"
                        onClick={() => createPost()}
                      >
                        <Avatar person={me} />
                        <span>What do you want to share?</span>
                        <Video size={20} />
                        <ImagePlus size={20} />
                        <AlignLeft size={20} />
                      </button>
                    )}
                    {activeWorld && (
                      <section className="world-feed-header">
                        <div className="world-feed-title">
                          <span className={"world-symbol " + activeWorld.icon}>
                            <WorldIcon name={activeWorld.icon} size={22} />
                          </span>
                          <div>
                            <h2>{activeWorld.name}</h2>
                            <small>
                              {activeWorld.kind === "personal" ? (
                                <>
                                  <Lock size={10} />
                                  Private personal feed
                                </>
                              ) : (
                                count(activeWorld.member_count) + " members"
                              )}
                            </small>
                          </div>
                          {activeWorld.kind === "public" &&
                            activeWorld.owner_id !== session?.user.id && (
                              <button
                                className="secondary small"
                                onClick={() =>
                                  void mutation(
                                    activeWorld.joined
                                      ? "leave_world"
                                      : "join_world",
                                    { world_id: activeWorld.id },
                                  )
                                }
                              >
                                {activeWorld.joined ? "Joined" : "Join World"}
                              </button>
                            )}
                          {activeWorld.owner_id === session?.user.id && (
                            <button
                              className="icon-button"
                              aria-label="Customize World"
                              onClick={() => {
                                setEditingWorld(activeWorld);
                                setModal("world");
                              }}
                            >
                              <Settings size={18} />
                            </button>
                          )}
                        </div>
                        <p>{activeWorld.description}</p>
                        <div className="world-feed-controls">
                          <label>
                            Feed style
                            <select
                              value={sort}
                              onChange={(e) =>
                                void preference("sort", e.target.value)
                              }
                            >
                              <option value="balanced">Balanced</option>
                              <option value="newest">Newest</option>
                              <option value="popular">Popular</option>
                            </select>
                          </label>
                          <div>
                            <label>
                              <input
                                type="checkbox"
                                checked={small}
                                onChange={(e) =>
                                  void preference(
                                    "small_creators",
                                    e.target.checked,
                                  )
                                }
                              />
                              Small creators
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={followedCommunities}
                                onChange={(e) =>
                                  void preference(
                                    "followed_communities",
                                    e.target.checked,
                                  )
                                }
                              />
                              Communities you follow
                            </label>
                          </div>
                        </div>
                        {activeWorld.announcement && (
                          <div className="announcement">
                            <Pin size={16} />
                            <p>{activeWorld.announcement}</p>
                          </div>
                        )}
                      </section>
                    )}
                    {activeCommunity && (
                      <section className="community-header panel">
                        <div className="section-head">
                          <h2>{activeCommunity.name}</h2>
                          <button
                            className="primary small"
                            onClick={() =>
                              void mutation(
                                activeCommunity.membership === "active"
                                  ? "leave_community"
                                  : "join_community",
                                { community_id: activeCommunity.id },
                              )
                            }
                          >
                            {activeCommunity.membership === "active"
                              ? "Joined"
                              : activeCommunity.membership === "pending"
                                ? "Requested"
                                : "Join"}
                          </button>
                        </div>
                        <p>{activeCommunity.description}</p>
                        <small>{activeCommunity.member_count} members</small>
                        {activeCommunity.announcement && (
                          <div className="announcement">
                            <Pin size={16} />
                            <p>{activeCommunity.announcement}</p>
                          </div>
                        )}
                        {["owner", "moderator"].includes(
                          activeCommunity.role || "",
                        ) && (
                          <button
                            className="text-button"
                            onClick={() => {
                              const body = window.prompt(
                                "Community announcement",
                                activeCommunity.announcement,
                              );
                              if (body !== null)
                                void mutation("community_announcement", {
                                  community_id: activeCommunity.id,
                                  body,
                                });
                            }}
                          >
                            Edit announcement
                          </button>
                        )}
                      </section>
                    )}
                    {page === "Profile" && creator && (
                      <section
                        className="creator-profile"
                        style={
                          {
                            "--profile-accent": creator.accent,
                          } as React.CSSProperties
                        }
                      >
                        <div className="creator-banner">
                          {creator.banner_path_url && (
                            <img src={creator.banner_path_url} alt="" />
                          )}
                        </div>
                        <div className="creator-info">
                          <Avatar person={creator} size="profile-avatar" />
                          <div className="profile-actions">
                            {ownProfile ? (
                              <>
                                <button
                                  className="secondary"
                                  onClick={() => setModal("profile")}
                                >
                                  Edit profile
                                </button>
                                <button
                                  className="primary"
                                  onClick={() => setModal("customize")}
                                >
                                  Customize
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="primary"
                                  onClick={() =>
                                    void mutation("follow", {
                                      target_id: creator.id,
                                    })
                                  }
                                >
                                  {creator.following ? "Following" : "Follow"}
                                </button>
                                <button
                                  className="secondary"
                                  onClick={() => void message(creator.id)}
                                >
                                  Message
                                </button>
                              </>
                            )}
                            <button
                              className="icon-button"
                              aria-label="Share profile"
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(
                                    location.origin + "/?profile=" + creator.id,
                                  )
                                  .then(() => alert("Profile link copied"))
                              }
                            >
                              <ExternalLink size={17} />
                            </button>
                          </div>
                          <h2>{creator.display_name}</h2>
                          <small>@{creator.username}</small>
                          <p>{creator.bio}</p>
                          <div className="profile-counts">
                            <span>
                              <strong>{count(creator.follower_count)}</strong>{" "}
                              followers
                            </span>
                            <span>
                              <strong>{count(creator.following_count)}</strong>{" "}
                              following
                            </span>
                            <span>
                              <strong>{count(creator.post_count)}</strong> posts
                            </span>
                          </div>
                        </div>
                      </section>
                    )}
                    {page === "Explore" && (
                      <section className="discovery-results">
                        {searchResults.worlds.length > 0 && (
                          <>
                            <div className="section-head">
                              <h2>Worlds to explore</h2>
                            </div>
                            <div className="world-rail">
                              {searchResults.worlds.map((w) => (
                                <WorldCard
                                  world={w}
                                  key={w.id}
                                  onClick={() => openWorld(w.id)}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        {searchResults.creators.length > 0 && (
                          <>
                            <div className="section-head">
                              <h2>Creators</h2>
                            </div>
                            {peopleList(searchResults.creators)}
                          </>
                        )}
                        {searchResults.communities.length > 0 && (
                          <>
                            <div className="section-head">
                              <h2>Communities</h2>
                            </div>
                            {communityList(searchResults.communities)}
                          </>
                        )}
                      </section>
                    )}
                    {page === "Communities" && !communityId ? (
                      <>
                        {communityList(boot.communities)}
                        {boot.communities.length === 0 && (
                          <Empty
                            title="A community starts with a shared interest."
                            text="Create a smaller space for discussions, posts and Events."
                            action={() =>
                              requireAccount(() => setModal("community"))
                            }
                            label="Create a community"
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <div
                          className="social-feed-tabs"
                          role="tablist"
                          aria-label="Content filters"
                        >
                          {(page === "Profile"
                            ? [
                                "Posts",
                                "Videos",
                                "Images",
                                "Discussions",
                                "Worlds",
                                "About",
                              ]
                            : activeWorld
                              ? [
                                  "For You",
                                  "Videos",
                                  "Images",
                                  "Discussions",
                                  "Creators",
                                  "Communities",
                                  "Events",
                                  ...(["owner", "moderator"].includes(
                                    activeWorld.role || "",
                                  )
                                    ? ["Moderation"]
                                    : []),
                                ]
                              : activeCommunity
                                ? [
                                    "For You",
                                    "Discussions",
                                    "Events",
                                    "Members",
                                  ]
                                : [
                                    "For You",
                                    "Following",
                                    "Videos",
                                    "Images",
                                    "Discussions",
                                    "Recent",
                                  ]
                          ).map((t) => (
                            <button
                              role="tab"
                              aria-selected={tab === t}
                              className={tab === t ? "active" : ""}
                              onClick={() => setTab(t)}
                              key={t}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        {tab === "Events" ? (
                          eventList()
                        ) : tab === "Creators" ? (
                          peopleList(
                            (worldDetail?.members || []).map((m) => m.user),
                          )
                        ) : tab === "Communities" ? (
                          communityList(worldDetail?.communities || [])
                        ) : tab === "Worlds" ? (
                          <div className="world-rail">
                            {creatorDetail?.worlds.map((w) => (
                              <WorldCard
                                key={w.id}
                                world={w}
                                onClick={() => openWorld(w.id)}
                              />
                            ))}
                          </div>
                        ) : tab === "About" && creator ? (
                          <div className="panel">
                            <h3>About {creator.display_name}</h3>
                            <p>{creator.bio || "No bio yet."}</p>
                            <div className="topic-picker">
                              {creator.interests.map((i) => (
                                <span key={i}>{i}</span>
                              ))}
                            </div>
                            {Object.entries(creator.social_links || {}).map(
                              ([name, url]) => (
                                <a
                                  className="social-link"
                                  key={name}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {name}
                                  <ExternalLink size={13} />
                                </a>
                              ),
                            )}
                            {ownProfile &&
                              creatorDetail &&
                              creatorDetail.requests.length > 0 && (
                                <>
                                  <h3>Follow requests</h3>
                                  {creatorDetail.requests
                                    .filter(Boolean)
                                    .map((p) => (
                                      <div className="person-row" key={p.id}>
                                        <Avatar person={p} />
                                        <strong>{p.display_name}</strong>
                                        <button
                                          className="primary small"
                                          onClick={() =>
                                            void mutation("accept_follow", {
                                              target_id: p.id,
                                            })
                                          }
                                        >
                                          Accept
                                        </button>
                                        <button
                                          className="text-button"
                                          onClick={() =>
                                            void mutation("decline_follow", {
                                              target_id: p.id,
                                            })
                                          }
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    ))}
                                </>
                              )}
                          </div>
                        ) : tab === "Members" ? (
                          <div className="panel">
                            {communityDetail?.members
                              .filter((m) => m.user)
                              .map((m) => (
                                <div className="person-row" key={m.user.id}>
                                  <Avatar person={m.user} />
                                  <button
                                    onClick={() => openProfile(m.user.id)}
                                  >
                                    {m.user.display_name}
                                  </button>
                                  <small>
                                    {m.role} · {m.status}
                                  </small>
                                  {["owner", "moderator"].includes(
                                    activeCommunity?.role || "",
                                  ) &&
                                    m.status === "pending" && (
                                      <button
                                        className="primary small"
                                        onClick={() =>
                                          void mutation("approve_member", {
                                            community_id: communityId,
                                            target_id: m.user.id,
                                          })
                                        }
                                      >
                                        Approve
                                      </button>
                                    )}
                                  {activeCommunity?.role === "owner" &&
                                    m.user.id !== session?.user.id && (
                                      <button
                                        className="secondary small"
                                        onClick={() =>
                                          void mutation("community_role", {
                                            community_id: communityId,
                                            target_id: m.user.id,
                                            role:
                                              m.role === "moderator"
                                                ? "member"
                                                : "moderator",
                                          })
                                        }
                                      >
                                        {m.role === "moderator"
                                          ? "Remove moderator"
                                          : "Make moderator"}
                                      </button>
                                    )}
                                </div>
                              ))}
                            {activeCommunity?.role === "owner" && (
                              <button
                                className="secondary"
                                onClick={() => {
                                  if (communityId)
                                    setInviteTarget({
                                      kind: "community",
                                      id: communityId,
                                    });
                                }}
                              >
                                Invite a member
                              </button>
                            )}
                          </div>
                        ) : tab === "Moderation" && activeWorld ? (
                          <div className="moderation-panel">
                            <section className="panel">
                              <h3>Pending posts</h3>
                              {worldDetail?.pending.length ? (
                                worldDetail.pending.filter(Boolean).map((p) => (
                                  <div className="pending-post" key={p.id}>
                                    <strong>{p.author?.display_name}</strong>
                                    <p>{p.title || p.body}</p>
                                    <button
                                      className="primary small"
                                      onClick={() =>
                                        void mutation("approve_post", {
                                          world_id: worldId,
                                          post_id: p.id,
                                        })
                                      }
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="secondary small"
                                      onClick={() =>
                                        void mutation("remove_world_post", {
                                          world_id: worldId,
                                          post_id: p.id,
                                        })
                                      }
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="hint">
                                  No posts waiting for review.
                                </p>
                              )}
                              <h3>World reports</h3>
                              {worldDetail?.reports.map((r) => (
                                <div className="pending-post" key={r.id}>
                                  <p>{r.reason}</p>
                                  <button
                                    className="secondary small"
                                    onClick={() =>
                                      void mutation("remove_world_post", {
                                        world_id: worldId,
                                        post_id: r.post_id,
                                      })
                                    }
                                  >
                                    Remove reported post from World
                                  </button>
                                </div>
                              ))}
                            </section>
                            <section className="panel">
                              <h3>Announcement</h3>
                              <button
                                className="secondary"
                                onClick={() => {
                                  const body = window.prompt(
                                    "World announcement",
                                    activeWorld.announcement,
                                  );
                                  if (body !== null)
                                    void mutation("world_announcement", {
                                      world_id: worldId,
                                      body,
                                    });
                                }}
                              >
                                Update announcement
                              </button>
                              <h3>Members and moderators</h3>
                              {worldDetail?.members
                                .filter((m) => m.user)
                                .map((m) => (
                                  <div className="person-row" key={m.user.id}>
                                    <Avatar person={m.user} />
                                    <strong>{m.user.display_name}</strong>
                                    <small>{m.role}</small>
                                    {activeWorld.owner_id ===
                                      session?.user.id &&
                                      m.user.id !== session.user.id && (
                                        <button
                                          className="secondary small"
                                          onClick={() =>
                                            void mutation("world_role", {
                                              world_id: worldId,
                                              target_id: m.user.id,
                                              role:
                                                m.role === "moderator"
                                                  ? "member"
                                                  : "moderator",
                                            })
                                          }
                                        >
                                          {m.role === "moderator"
                                            ? "Make member"
                                            : "Make moderator"}
                                        </button>
                                      )}
                                  </div>
                                ))}
                              {activeWorld.owner_id === session?.user.id && (
                                <button
                                  className="secondary"
                                  onClick={() => {
                                    if (worldId)
                                      setInviteTarget({
                                        kind: "world",
                                        id: worldId,
                                      });
                                  }}
                                >
                                  Invite a member
                                </button>
                              )}
                              <p className="hint">{activeWorld.rules}</p>
                            </section>
                          </div>
                        ) : (
                          postList()
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </main>
          {!["Inbox", "Events"].includes(page) && !room && (
            <aside className="social-rightbar">
              <section className="panel">
                <div className="section-head">
                  <h3>Trending Worlds</h3>
                  <button onClick={() => navigate("Explore")}>See all</button>
                </div>
                {boot.worlds
                  .filter((w) => w.kind === "public")
                  .slice()
                  .sort(
                    (a, b) =>
                      b.post_count - a.post_count ||
                      b.member_count - a.member_count,
                  )
                  .slice(0, 5)
                  .map((w, i) => (
                    <button
                      className="trending-world"
                      key={w.id}
                      onClick={() => openWorld(w.id)}
                    >
                      <span>{i + 1}</span>
                      <span className={"world-symbol " + w.icon}>
                        <WorldIcon name={w.icon} size={17} />
                      </span>
                      <div>
                        <strong>{w.name}</strong>
                        <small>
                          {count(w.member_count)} members · {w.post_count} posts
                        </small>
                      </div>
                    </button>
                  ))}
                {!boot.worlds.some((w) => w.kind === "public") && (
                  <p className="widget-empty">
                    Public Worlds will appear here as people build them.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="section-head">
                  <h3>Suggested creators</h3>
                  <button onClick={() => navigate("Explore")}>See all</button>
                </div>
                {boot.creators.slice(0, 4).map((p) => (
                  <div className="suggested-creator" key={p.id}>
                    <button onClick={() => openProfile(p.id)}>
                      <Avatar person={p} />
                      <span>
                        <strong>{p.display_name}</strong>
                        <small>{count(p.follower_count)} followers</small>
                      </span>
                    </button>
                    <button
                      className="primary small"
                      onClick={() =>
                        void mutation("follow", { target_id: p.id })
                      }
                    >
                      {p.following ? "Following" : "Follow"}
                    </button>
                  </div>
                ))}
                {!boot.creators.length && (
                  <p className="widget-empty">
                    New creators arrive with every new account. Share your first
                    post.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="section-head">
                  <h3>Active communities</h3>
                  <button onClick={() => navigate("Communities")}>
                    See all
                  </button>
                </div>
                {boot.communities.slice(0, 4).map((c) => (
                  <button
                    className="community-widget"
                    key={c.id}
                    onClick={() => openCommunity(c.id)}
                  >
                    <span className="world-symbol">
                      <Users size={17} />
                    </span>
                    <div>
                      <strong>{c.name}</strong>
                      <small>{count(c.member_count)} members</small>
                    </div>
                    <ChevronRight size={13} />
                  </button>
                ))}
                {!boot.communities.length && (
                  <p className="widget-empty">
                    A smaller space for your people. Create a community around
                    an interest.
                  </p>
                )}
              </section>
              <div className="rightbar-note">
                <Sparkles size={20} />
                <p>
                  Different interests.
                  <br />
                  One Common.
                </p>
                <button
                  onClick={() =>
                    requireAccount(() => {
                      setEditingWorld(undefined);
                      setPreset(undefined);
                      setModal("world");
                    })
                  }
                >
                  Build your World
                  <ArrowRight size={14} />
                </button>
              </div>
              <footer>
                <button onClick={() => setModal("settings")}>
                  Privacy & settings
                </button>
                <span>common. © 2026</span>
              </footer>
            </aside>
          )}
        </div>
      </div>
      <nav className="social-bottom-nav" aria-label="Mobile navigation">
        {[
          { name: "Home", icon: Home },
          { name: "Explore", icon: Compass },
          { name: "Create", icon: PlusCircle },
          { name: "Worlds", icon: Globe },
          { name: "Profile", icon: User },
        ].map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() =>
              name === "Create"
                ? createPost()
                : name === "Profile"
                  ? session
                    ? openProfile(session.user.id)
                    : setModal("auth")
                  : navigate(name)
            }
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {modal === "auth" && (
        <Auth
          configured={configured}
          onClose={() => setModal(null)}
          onSession={account.keepSession}
        />
      )}{" "}
      {(modal === "profile" ||
        (!onboardingDismissed && profile && !profile.onboarded)) &&
        session &&
        profile && (
          <ProfileEditor
            profile={profile}
            session={session}
            onClose={() => {
              setModal(null);
              setOnboardingDismissed(true);
            }}
            onSaved={() => {
              setOnboardingDismissed(true);
              void account.reloadProfile();
              void refresh();
            }}
          />
        )}
      {modal === "post" && session && (
        <Composer
          session={session}
          worlds={boot.worlds}
          communities={boot.communities}
          worldId={activeWorld?.kind === "public" ? activeWorld.id : undefined}
          communityId={communityId || undefined}
          quotedPostId={quotedPost}
          initialTopics={activeWorld?.topics}
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            void refresh();
            alert("Your post is live.");
          }}
        />
      )}
      {modal === "world" && session && (
        <WorldEditor
          session={session}
          world={editingWorld}
          preset={preset}
          onClose={() => setModal(null)}
          onSaved={(id) => {
            setModal(null);
            void loadBoot();
            openWorld(id);
            alert("Your World is ready.");
          }}
        />
      )}
      {modal === "community" && session && (
        <CommunityEditor
          session={session}
          worlds={boot.worlds}
          onClose={() => setModal(null)}
          onCreated={(id) => {
            setModal(null);
            void loadBoot();
            openCommunity(id);
          }}
        />
      )}
      {modal === "customize" && session && creator && (
        <CreatorSettings
          session={session}
          profile={creator}
          onClose={() => setModal(null)}
          onSaved={() => void refresh()}
        />
      )}{" "}
      {modal === "settings" && (
        <SettingsPanel
          session={session}
          onClose={() => setModal(null)}
          onLogout={() =>
            void account.logout().then(() => {
              setModal(null);
              navigate("Home");
            })
          }
          onDeleted={() => location.reload()}
          onNotice={alert}
        />
      )}{" "}
      {modal === "event" && session && (
        <CreateMoment
          session={session}
          worldId={worldId || undefined}
          communityId={communityId || undefined}
          onClose={() => setModal(null)}
          onCreated={(id) => {
            setModal(null);
            setRoom(id);
            void loadEvents();
          }}
        />
      )}
      {inviteTarget && session && (
        <MemberPicker
          session={session}
          onClose={() => setInviteTarget(null)}
          onSelect={async (id) => {
            await act(
              inviteTarget.kind === "world" ? "world_role" : "community_role",
              {
                [inviteTarget.kind === "world" ? "world_id" : "community_id"]:
                  inviteTarget.id,
                target_id: id,
                role: "member",
              },
              session,
            );
            await refresh();
            alert("Invitation saved.");
          }}
        />
      )}
      {commentPost && (
        <Comments
          post={commentPost}
          session={session}
          onClose={() => {
            setCommentPost(null);
            history.replaceState(null, "", location.pathname);
          }}
          onAuth={() => {
            setCommentPost(null);
            setModal("auth");
          }}
          onChanged={() => void loadFeed()}
        />
      )}
    </div>
  );
}
