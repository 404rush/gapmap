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

async function send<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch {
    if (signal?.aborted) throw new ApiError(CANCELLED, 499);
    throw new ApiError("Couldn't reach the GapMap server. Check your connection and try again.", 0);
  }
  return handle<T>(res);
}

export function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return send<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, signal);
}

export function postForm<T>(url: string, form: FormData, signal?: AbortSignal): Promise<T> {
  return send<T>(url, { method: "POST", body: form }, signal);
}
