export class BackendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BackendError";
  }
}
export function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, key };
}
export async function sb(path: string, token?: string, init: RequestInit = {}) {
  const { url, key } = config();
  if (!url || !key) throw new Error("Common’s database is not connected yet.");
  const r = await fetch(url + path, {
    ...init,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await r.text();
  let data;
  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    throw new Error("The database returned an unreadable response.");
  }
  if (!r.ok)
    throw new BackendError(
      data?.msg || data?.message || data?.error_description || "Request failed",
      r.status,
    );
  return data;
}
export async function user(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("Sign in to continue.");
  const token = header.slice(7);
  const u = await sb("/auth/v1/user", token);
  if (!u?.id) throw new Error("Sign in to continue.");
  return { token, id: u.id };
}
