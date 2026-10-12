import { z } from "zod";
import { sb, user, config } from "@/lib/backend";
import {
  worldSchema,
  postSchema,
  communitySchema,
} from "@/lib/social/validation";
const readKinds = [
  "bootstrap",
  "feed",
  "post",
  "comments",
  "world",
  "community",
  "profile",
  "search",
  "conversations",
  "conversation",
  "analytics",
];
const json = (data: unknown) =>
  Response.json(data, { headers: { "Cache-Control": "no-store" } });
async function signAssets(value: unknown, token?: string): Promise<unknown> {
  const paths = new Set<string>();
  function scan(v: unknown) {
    if (Array.isArray(v)) {
      v.forEach(scan);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (
          ["path", "cover", "avatar_path", "banner_path"].includes(k) &&
          typeof x === "string" &&
          /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp|mp4)$/.test(x)
        )
          paths.add(x);
        else scan(x);
      }
    }
  }
  scan(value);
  const urls = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (path) => {
      try {
        const signed = await sb(
          "/storage/v1/object/sign/social-media/" + path,
          token,
          { method: "POST", body: JSON.stringify({ expiresIn: 3600 }) },
        );
        urls.set(path, config().url + "/storage/v1" + signed.signedURL);
      } catch {
        urls.set(path, "");
      }
    }),
  );
  function map(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(map);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        o[k] = map(x);
        if (typeof x === "string" && urls.has(x)) o[k + "_url"] = urls.get(x);
      }
      return o;
    }
    return v;
  }
  return map(value);
}
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams,
      kind = q.get("kind") || "bootstrap";
    if (!readKinds.includes(kind)) throw new Error("Unknown resource.");
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    const payload: Record<string, unknown> = {};
    for (const k of [
      "world_id",
      "community_id",
      "target_id",
      "post_id",
      "conversation_id",
    ])
      if (q.get(k)) payload[k] = z.string().uuid().parse(q.get(k));
    for (const k of ["query", "sort", "tab", "before"])
      if (q.get(k)) payload[k] = z.string().max(300).parse(q.get(k));
    for (const k of ["small_creators", "followed_communities"])
      if (q.has(k)) payload[k] = q.get(k) === "true";
    if (q.has("days"))
      payload.days = z.coerce
        .number()
        .int()
        .min(1)
        .max(90)
        .parse(q.get("days"));
    if (q.get("cursor"))
      payload.cursor = z
        .object({
          id: z.string().uuid(),
          score: z.number(),
          created_at: z.string(),
          as_of:z.string().optional(),
        })
        .parse(JSON.parse(q.get("cursor")!));
    const data = await sb("/rest/v1/rpc/social_read", token, {
      method: "POST",
      body: JSON.stringify({ operation: kind, payload }),
    });
    return json(await signAssets(data, token));
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError ? e.issues[0].message : (e as Error).message,
      },
      { status: 400 },
    );
  }
}
export async function POST(req: Request) {
  try {
    const { token } = await user(req);
    const raw = z
      .object({
        action: z.string(),
        payload: z.record(z.unknown()).default({}),
      })
      .parse(await req.json());
    let payload = raw.payload;
    const base = z.object({
      post_id: z.string().uuid().optional(),
      world_id: z.string().uuid().optional(),
      community_id: z.string().uuid().optional(),
      target_id: z.string().uuid().optional(),
      body: z.string().max(12000).optional(),
      title: z.string().max(150).optional(),
      reason: z.string().min(10).max(1000).optional(),
      parent_id: z.string().uuid().nullable().optional(),
      comment_id: z.string().uuid().optional(),
      conversation_id: z.string().uuid().optional(),
      message_id: z.string().uuid().optional(),
      role: z.enum(["member", "moderator"]).optional(),
      option_index: z.number().int().min(0).max(5).optional(),
      watch_seconds: z.number().min(0).max(180).optional(),
    });
    if (raw.action === "create_world") payload = worldSchema.parse(payload);
    else if (raw.action === "update_world")
      payload = {
        ...worldSchema.parse(payload),
        world_id: z.string().uuid().parse(payload.world_id),
      };
    else if (raw.action === "create_post") payload = postSchema.parse(payload);
    else if (raw.action === "create_community")
      payload = communitySchema.parse(payload);
    else if (raw.action === "create_conversation")
      payload = z
        .object({
          members: z.array(z.string().uuid()).min(1).max(11),
          title: z.string().max(80).default(""),
        })
        .parse(payload);
    else if (raw.action === "world_preferences")
      payload = z
        .object({
          world_id: z.string().uuid(),
          sort: z.enum(["balanced", "newest", "popular"]),
          small_creators: z.boolean(),
          followed_communities: z.boolean(),
        })
        .parse(payload);
    else if (raw.action === "profile_customize")
      payload = z
        .object({
          accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          layout: z.enum(["grid", "list"]),
          visibility: z.enum(["public", "private"]),
          social_links: z
            .record(
              z
                .string()
                .url()
                .refine((v) => v.startsWith("https://"), "Use HTTPS links."),
            )
            .default({}),
          avatar_path: assetOptional(),
          banner_path: assetOptional(),
        })
        .parse(payload);
    else payload = base.parse(payload);
    const result = await sb("/rest/v1/rpc/social_action", token, {
      method: "POST",
      body: JSON.stringify({ operation: raw.action, payload }),
    });
    return json(result);
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError ? e.issues[0].message : (e as Error).message,
      },
      { status: 400 },
    );
  }
}
function assetOptional() {
  return z
    .string()
    .regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/)
    .nullable()
    .optional();
}
