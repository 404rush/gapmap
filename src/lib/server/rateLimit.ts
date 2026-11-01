// Best-effort, in-memory rate limiting per client address, so a public demo
// link can't burn through the free AI and search quotas. Each serverless
// instance keeps its own counts; set RATE_LIMIT=off to disable.

interface Window {
  count: number;
  reset: number;
}

const buckets = new Map<string, Window>();

export const LIMITS = {
  ai: [
    { max: 30, ms: 60_000 },
    { max: 300, ms: 3_600_000 },
  ],
  fetch: [{ max: 40, ms: 60_000 }],
  search: [
    { max: 15, ms: 60_000 },
    { max: 100, ms: 3_600_000 },
  ],
} as const;

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

/** Returns a 429 Response when over the limit, otherwise null (and counts the request). */
export function rateLimit(req: Request, kind: keyof typeof LIMITS, now = Date.now()): Response | null {
  if (process.env.RATE_LIMIT === "off") return null;
  const who = clientKey(req);
  for (const { max, ms } of LIMITS[kind]) {
    const key = `${kind}:${ms}:${who}`;
    const w = buckets.get(key);
    if (!w || w.reset <= now) buckets.set(key, { count: 1, reset: now + ms });
    else if (w.count >= max) {
      const secs = Math.ceil((w.reset - now) / 1000);
      return Response.json(
        { error: `Too many requests from this connection. Try again in ${secs < 90 ? `${secs} seconds` : `${Math.ceil(secs / 60)} minutes`}.` },
        { status: 429, headers: { "retry-after": String(secs) } },
      );
    } else w.count++;
  }
  if (buckets.size > 5000) for (const [k, w] of buckets) if (w.reset <= now) buckets.delete(k);
  return null;
}

/** Reject oversized bodies before parsing them. */
export function tooLarge(req: Request, maxBytes: number): Response | null {
  const len = Number(req.headers.get("content-length") ?? 0);
  return len > maxBytes ? Response.json({ error: "That request is too large. Try fewer or shorter sources." }, { status: 413 }) : null;
}
