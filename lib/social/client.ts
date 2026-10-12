import { api, type Session } from "@/lib/client";
export type Creator = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  interests: string[];
  avatar_path?: string;
  avatar_path_url?: string;
  banner_path?: string;
  banner_path_url?: string;
  accent: string;
  layout: "grid" | "list";
  social_links: Record<string, string>;
  visibility: "public" | "private";
  follower_count: number;
  following_count: number;
  post_count: number;
  following: boolean;
  follows_you: boolean;
};
export type Mix = {
  video: number;
  image: number;
  text: number;
  community: number;
};
export type World = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  kind: "personal" | "public";
  visibility: string;
  category: string;
  topics: string[];
  cover: string;
  cover_url?: string;
  icon: string;
  content_mix: Mix;
  contribution: string;
  rules: string;
  announcement: string;
  member_count: number;
  post_count: number;
  joined: boolean;
  role: string | null;
  preferences?: {
    sort: string;
    small_creators: boolean;
    followed_communities: boolean;
  } | null;
};
export type Community = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: string;
  approval_required: boolean;
  announcement: string;
  member_count: number;
  role: string | null;
  membership: string | null;
  world_ids: string[];
};
export type Media = {
  id: string;
  path: string;
  path_url?: string;
  kind: "video" | "image";
  alt: string;
  duration_seconds?: number;
};
export type Post = {
  id: string;
  author_id: string;
  author: Creator;
  type: "video" | "image" | "text" | "poll";
  title: string;
  body: string;
  topics: string[];
  visibility: string;
  community_id?: string;
  community?: Community;
  media: Media[];
  worlds: { id: string; name: string; icon: string }[];
  created_at: string;
  updated_at: string;
  likes: number;
  comments: number;
  saves: number;
  views: number;
  shares: number;
  reposts: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  pinned: boolean;
  poll_options?: string[];
  poll_closes_at?: string;
  vote?: number | null;
  poll_results: { option: number; votes: number }[];
  quoted?: { id: string; body: string; title: string; author: Creator } | null;
};
export type Cursor = { id: string; score: number; created_at: string; as_of?:string };
export type Bootstrap = {
  worlds: World[];
  creators: Creator[];
  communities: Community[];
  following_ids: string[];
};
export async function read<T>(
  kind: string,
  args: Record<string, unknown> = {},
  session?: Session | null,
): Promise<T> {
  const query = new URLSearchParams({ kind });
  for (const [k, v] of Object.entries(args))
    if (v !== undefined && v !== null && v !== "")
      query.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  return api<T>("/api/social?" + query, session?.access_token);
}
export async function act<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown>,
  session: Session,
) {
  return api<T>("/api/social", session.access_token, { action, payload });
}
export function count(n: number) {
  return Intl.NumberFormat(undefined, {
    notation: n >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n || 0);
}
export function relative(date: string) {
  const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  return seconds < 60
    ? "Now"
    : seconds < 3600
      ? Math.floor(seconds / 60) + "m"
      : seconds < 86400
        ? Math.floor(seconds / 3600) + "h"
        : Math.floor(seconds / 86400) + "d";
}
export function worldCover(w: Pick<World, "cover" | "cover_url">) {
  return (
    w.cover_url ||
    "/covers/" +
      (/^world-(gaming|music|creator|comedy)$/.test(w.cover)
        ? w.cover
        : "world-gaming") +
      ".webp"
  );
}
export async function upload(
  file: File,
  session: Session,
  progress: (v: number) => void,
) {
  const allowed = ["image/png", "image/jpeg", "image/webp", "video/mp4"];
  if (!allowed.includes(file.type))
    throw new Error("Choose a PNG, JPEG, WebP, or MP4 file.");
  const max = file.type === "video/mp4" ? 100 : 10;
  if (file.size > max * 1024 * 1024)
    throw new Error("Choose a file smaller than " + max + " MB.");
  const prepared = await api<{ id: string; path: string; url: string }>(
    "/api/media",
    session.access_token,
    { action: "begin", mime: file.type, size: file.size },
  );
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", prepared.url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 90));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("The file did not upload. Try again."));
    xhr.onerror = () =>
      reject(new Error("Upload interrupted. Check your connection."));
    xhr.send(file);
  });
  progress(95);
  const finished = await api<{
    id: string;
    path: string;
    kind: "video" | "image";
    duration_seconds: number;
  }>("/api/media", session.access_token, { action: "finish", id: prepared.id });
  progress(100);
  return { ...finished, alt: "" };
}
export async function thumbnail(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video"),
      url = URL.createObjectURL(file);
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.src = "";
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.2, video.duration / 2);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(900, video.videoWidth);
      canvas.height = Math.round(
        (canvas.width * video.videoHeight) / video.videoWidth,
      );
      canvas
        .getContext("2d")
        ?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          resolve(
            blob
              ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" })
              : null,
          );
        },
        "image/jpeg",
        0.85,
      );
    };
    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };
  });
}
