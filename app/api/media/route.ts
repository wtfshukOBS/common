import { z } from "zod";
import { sb, user, config } from "@/lib/backend";
import {
  identifyImage,
  mp4Duration,
  validationSignature,
} from "@/lib/social/media";
export async function POST(req: Request) {
  try {
    const { token, id } = await user(req);
    const b = z
      .object({
        action: z.enum(["begin", "finish"]),
        mime: z
          .enum(["image/png", "image/jpeg", "image/webp", "video/mp4"])
          .optional(),
        size: z.number().int().min(1).max(104857600).optional(),
        id: z.string().uuid().optional(),
      })
      .parse(await req.json());
    if (b.action === "begin") {
      if (!b.mime || !b.size) throw new Error("Choose a media file.");
      const ext = {
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
          "video/mp4": "mp4",
        }[b.mime],
        path = id + "/" + crypto.randomUUID() + "." + ext;
      const mid = await sb("/rest/v1/rpc/register_media", token, {
        method: "POST",
        body: JSON.stringify({
          file_path: path,
          mime_type: b.mime,
          file_size: b.size,
          media_kind: b.mime === "video/mp4" ? "video" : "image",
        }),
      });
      const signed = await sb(
        "/storage/v1/object/upload/sign/social-media/" + path,
        token,
        { method: "POST", body: JSON.stringify({ upsert: false }) },
      );
      return Response.json({
        id: mid,
        path,
        url: config().url + "/storage/v1" + signed.url,
        token: signed.token,
      });
    }
    const rows = await sb(
      "/rest/v1/uploaded_media?id=eq." +
        b.id +
        "&owner_id=eq." +
        id +
        "&select=*",
      token,
    );
    const m = rows[0];
    if (!m || m.status !== "pending") throw new Error("Upload unavailable.");
    const url =
      config().url + "/storage/v1/object/authenticated/social-media/" + m.path;
    const { key } = config();
    const head = await fetch(url, {
      method: "HEAD",
      headers: { apikey: key!, Authorization: "Bearer " + token },
    });
    if (!head.ok || Number(head.headers.get("content-length")) !== m.size_bytes)
      throw new Error("The upload did not finish correctly.");
    const first = await fetch(url, {
      headers: {
        apikey: key!,
        Authorization: "Bearer " + token,
        Range: "bytes=0-65535",
      },
    });
    const bytes = new Uint8Array(await first.arrayBuffer());
    let duration = 0;
    if (m.kind === "image") {
      if (!identifyImage(bytes, m.mime))
        throw new Error("The file is not a supported image.");
    } else {
      if (new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp")
        throw new Error("Choose a standard MP4 video.");
      let detected = mp4Duration(bytes);
      if (!detected) {
        const tail = await fetch(url, {
          headers: {
            apikey: key!,
            Authorization: "Bearer " + token,
            Range: "bytes=" + Math.max(0, m.size_bytes - 1048576) + "-",
          },
        });
        detected = mp4Duration(new Uint8Array(await tail.arrayBuffer()));
      }
      if (!detected || detected > 180)
        throw new Error("Choose an MP4 video up to 3 minutes long.");
      duration = detected;
    }
    await sb("/rest/v1/rpc/finalize_media", token, {
      method: "POST",
      body: JSON.stringify({
        media_uuid: m.id,
        duration,
        signature: validationSignature(m.id, m.size_bytes, duration),
      }),
    });
    return Response.json({
      id: m.id,
      path: m.path,
      kind: m.kind,
      duration_seconds: duration,
    });
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
