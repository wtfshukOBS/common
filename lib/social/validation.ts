import { z } from "zod";
export const topics = [
  "Gaming",
  "Music",
  "Comedy",
  "Anime",
  "Technology",
  "Fitness",
  "Art",
  "Movies",
  "Books",
  "Creators",
  "Photography",
  "Food",
];
export const mixSchema = z
  .object({
    video: z.number().min(0).max(100),
    image: z.number().min(0).max(100),
    text: z.number().min(0).max(100),
    community: z.number().min(0).max(100),
  })
  .refine(
    (m) => Object.values(m).reduce((a, b) => a + b, 0) > 0,
    "Choose at least one content type.",
  );
export const assetPath = z
  .string()
  .regex(
    /^(world-(gaming|music|creator|comedy)|[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp))$/,
  );
export const worldSchema = z.object({
  name: z.string().trim().min(3).max(50),
  description: z.string().trim().max(1000),
  kind: z.enum(["personal", "public"]),
  visibility: z.enum(["public", "private"]),
  category: z.string().min(2).max(40),
  topics: z.array(z.string().trim().min(1).max(40)).max(5),
  cover: assetPath,
  icon: z.enum([
    "gamepad",
    "music",
    "camera",
    "smile",
    "sparkles",
    "dumbbell",
    "palette",
    "globe",
  ]),
  content_mix: mixSchema,
  contribution: z.enum(["anyone", "members", "approval", "owner"]),
  rules: z.string().max(2000),
});
export const postSchema = z
  .object({
    type: z.enum(["video", "image", "text", "poll"]),
    title: z.string().trim().max(150),
    body: z.string().trim().max(12000),
    topics: z.array(z.string().trim().min(1).max(40)).max(5),
    visibility: z.enum(["public", "followers", "private"]),
    world_ids: z.array(z.string().uuid()).max(8),
    community_id: z.string().uuid().nullable().optional(),
    quoted_post_id: z.string().uuid().nullable().optional(),
    media: z
      .array(z.object({ id: z.string().uuid(), alt: z.string().max(500) }))
      .max(8),
    poll_options: z
      .array(z.string().trim().min(1).max(100))
      .min(2)
      .max(6)
      .optional(),
    poll_closes_at: z.string().datetime().optional(),
  })
  .superRefine((v, c) => {
    if (!v.title && !v.body && !v.media.length)
      c.addIssue({ code: "custom", message: "Add something to your post." });
    if (v.type === "image" && !v.media.length)
      c.addIssue({ code: "custom", message: "Choose at least one image." });
    if (v.type === "video" && !v.media.length)
      c.addIssue({ code: "custom", message: "Choose a video." });
    if (
      v.type === "poll" &&
      (!v.poll_options ||
        !v.poll_closes_at ||
        new Date(v.poll_closes_at).getTime() <= Date.now())
    )
      c.addIssue({
        code: "custom",
        message: "Add poll options and a future closing date.",
      });
    if (v.world_ids.length && v.visibility !== "public")
      c.addIssue({
        code: "custom",
        message: "Posts shared to public Worlds must be public.",
      });
  });
export const communitySchema = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().max(1000),
  visibility: z.enum(["public", "private"]),
  approval_required: z.boolean(),
  world_ids: z.array(z.string().uuid()).max(5),
});
export function normalizeMix(m: Record<string, number>) {
  const entries = Object.entries(m).map(
    ([k, v]) => [k, Math.max(0, Number.isFinite(v) ? v : 0)] as const,
  );
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (!total) throw new Error("Choose at least one content type.");
  return Object.fromEntries(entries.map(([k, v]) => [k, v / total]));
}
