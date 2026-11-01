// Browser-side API calls with plain-language errors and cancellation.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const CANCELLED = "Analysis cancelled.";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && typeof data.error === "string" && data.error) ||
      (res.status === 504
        ? "The server ran out of time. Try again with fewer or shorter sources."
        : res.status === 413
          ? "That request is too large. Try fewer or shorter sources."
          : `The server returned an error (${res.status}). Try again.`);
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError(CANCELLED, 499));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new ApiError(CANCELLED, 499))), { once: true });
  });
}

/** The hosting platform's own gateway errors (not GapMap's, which carry a JSON message). */
const isGatewayError = (res: Response) =>
  [502, 503, 504].includes(res.status) && !(res.headers.get("content-type") ?? "").includes("application/json");

// A dropped connection or a gateway hiccup is retried once, after a short pause,
// before the user sees an error. Every call here is safe to repeat.
async function send<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal });
    } catch {
      if (signal?.aborted) throw new ApiError(CANCELLED, 499);
      if (attempt === 0) {
        await pause(1500, signal);
        continue;
      }
      throw new ApiError("Couldn't reach the GapMap server. Check your connection and try again.", 0);
    }
    if (attempt === 0 && isGatewayError(res)) {
      await pause(1500, signal);
      continue;
    }
    return handle<T>(res);
  }
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return send<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, signal);
}

export function postForm<T>(url: string, form: FormData, signal?: AbortSignal): Promise<T> {
  return send<T>(url, { method: "POST", body: form }, signal);
}
