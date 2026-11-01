// Minimal LLM client with JSON output. Supports Google Gemini (free tier)
// and any OpenAI-compatible endpoint (Groq, OpenRouter, a local server...).
// No SDKs, just fetch, so model or version changes don't break the build.
// Every call has a time budget, and failures become plain-language errors.

const GEMINI_FALLBACKS = ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];
/** Override only to route through a proxy or a local test server. */
const GEMINI_BASE = (process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");

export type Provider = "gemini" | "openai-compatible";

/** Gemini's OpenAPI-style schema subset, used for structured output. */
export interface GeminiSchema {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "BOOLEAN";
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  enum?: string[];
  format?: string;
  required?: string[];
}

export function llmProvider(): Provider | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_COMPAT_API_KEY && process.env.OPENAI_COMPAT_BASE_URL) return "openai-compatible";
  return null;
}

export function llmLabel(): string | null {
  const p = llmProvider();
  if (p === "gemini") return `Gemini (${workingGeminiModel || process.env.GEMINI_MODEL || GEMINI_FALLBACKS[0]})`;
  if (p === "openai-compatible") return process.env.OPENAI_COMPAT_MODEL || "OpenAI-compatible model";
  return null;
}

export class LlmError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export const MSG = {
  key: "The AI key was rejected. Check GEMINI_API_KEY (or your OpenAI-compatible key) in the environment settings.",
  quota: "The free AI quota is used up for the moment. Wait a minute and try again, or use the sample demo.",
  timeout: "The AI took too long to answer. Try again, or use fewer or shorter sources.",
  safety: "The AI declined to process this content (safety filter). Try a different source.",
  truncated: "The AI's reply was cut off before it finished. Try fewer sources or a narrower question.",
  invalid: "The AI's reply couldn't be read. Try again.",
  down: "The AI service isn't responding right now. Try again in a minute.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** Extract the first JSON object/array from a model reply. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new LlmError(MSG.invalid);
  }
}

interface Reply {
  text: string;
  truncated: boolean;
  model: string;
}

let workingGeminiModel: string | null = null;
const schemaRejected = new Set<string>();
let discovered: string[] | null = null;

/** Ask the API which models this key can use, as a last resort when the known names are gone. */
async function discoverGeminiModels(key: string, deadline: number): Promise<string[]> {
  if (discovered) return discovered;
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(Math.max(1000, Math.min(8000, deadline - Date.now() - 2000))),
    });
    if (!res.ok) return (discovered = []);
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    discovered = (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /flash/i.test(m.name) && !/image|tts|audio|live|embed/i.test(m.name))
      .map((m) => m.name.replace(/^models\//, ""))
      .sort((a, b) => Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)));
    return discovered;
  } catch {
    return [];
  }
}

async function callGemini(system: string, prompt: string, schema: GeminiSchema | undefined, deadline: number): Promise<Reply> {
  const key = process.env.GEMINI_API_KEY!;
  let candidates = [workingGeminiModel, process.env.GEMINI_MODEL, ...GEMINI_FALLBACKS].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);
  let lastStatus = 0;
  let discoveredOnce = false;
  for (let mi = 0; mi < candidates.length; mi++) {
    const model = candidates[mi];
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 4000) throw new LlmError(MSG.timeout, 504);
      const useSchema = !!schema && !schemaRejected.has(model);
      let res: Response;
      try {
        res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
              ...(useSchema ? { responseSchema: schema } : {}),
            },
          }),
          signal: AbortSignal.timeout(Math.min(90_000, remaining - 1500)),
        });
      } catch {
        lastStatus = 504;
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        const cand = data?.candidates?.[0];
        const finish: string = cand?.finishReason ?? "";
        const text = ((cand?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("");
        if (!text) {
          if (data?.promptFeedback?.blockReason || /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|SPII/.test(finish)) throw new LlmError(MSG.safety, 422);
          lastStatus = 502;
          continue;
        }
        workingGeminiModel = model;
        return { text, truncated: finish === "MAX_TOKENS", model };
      }
      const body = await res.text();
      lastStatus = res.status;
      if (res.status === 400 && useSchema && /schema|Unknown name|Invalid JSON payload/i.test(body)) {
        schemaRejected.add(model); // retry at once without structured output
        attempt--;
        continue;
      }
      if (res.status === 429) {
        if (/per.?day|daily|quota exceeded for metric.*day/i.test(body)) break; // daily limit: try another model
        const m = body.match(/retryDelay"?\s*:\s*"?(\d+)/);
        await sleep(Math.min((m ? +m[1] * 1000 : 4000) * (attempt + 1), deadline - Date.now() - 5000));
        continue;
      }
      if (res.status === 404 || (res.status === 400 && /model|not found|not supported/i.test(body))) break;
      if (res.status === 401 || res.status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(body)) throw new LlmError(MSG.key, 401);
      if (res.status === 400) throw new LlmError(`The AI rejected the request: ${body.match(/"message":\s*"([^"]{0,160})/)?.[1] ?? "bad request"}.`, 400);
      await sleep(Math.min(1500 * (attempt + 1), deadline - Date.now() - 5000));
    }
    if (mi === candidates.length - 1 && !discoveredOnce && lastStatus !== 429) {
      discoveredOnce = true;
      const extra = (await discoverGeminiModels(key, deadline)).filter((m) => !candidates.includes(m)).slice(0, 3);
      candidates = [...candidates, ...extra];
    }
  }
  if (lastStatus === 429) throw new LlmError(MSG.quota, 429);
  if (lastStatus === 504) throw new LlmError(MSG.timeout, 504);
  throw new LlmError(MSG.down, 503);
}

async function callOpenAiCompatible(system: string, prompt: string, deadline: number): Promise<Reply> {
  const base = process.env.OPENAI_COMPAT_BASE_URL!.replace(/\/$/, "");
  const model = process.env.OPENAI_COMPAT_MODEL || "llama-3.3-70b-versatile";
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 4000) throw new LlmError(MSG.timeout, 504);
    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_COMPAT_API_KEY}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(Math.min(90_000, remaining - 1500)),
      });
    } catch {
      lastStatus = 504;
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      const choice = data?.choices?.[0];
      const text: string = choice?.message?.content ?? "";
      if (!text) {
        lastStatus = 502;
        continue;
      }
      return { text, truncated: choice?.finish_reason === "length", model };
    }
    lastStatus = res.status;
    if (res.status === 401 || res.status === 403) throw new LlmError(MSG.key, 401);
    if (res.status === 429 || res.status >= 500) {
      await sleep(Math.min(4000 * (attempt + 1), deadline - Date.now() - 5000));
      continue;
    }
    throw new LlmError(`The AI rejected the request (${res.status}).`, 400);
  }
  throw new LlmError(lastStatus === 429 ? MSG.quota : lastStatus === 504 ? MSG.timeout : MSG.down, lastStatus === 429 ? 429 : 503);
}

export interface LlmOptions {
  schema?: GeminiSchema;
  /** Absolute time (ms) by which the call must finish, retries included. */
  deadline?: number;
}

export async function llmJson<T>(system: string, prompt: string, opts: LlmOptions = {}): Promise<{ data: T; model: string }> {
  const p = llmProvider();
  if (!p) throw new LlmError("No AI key is set up. Add GEMINI_API_KEY to .env.local (or the host's environment settings), or use the sample demo.", 400);
  const deadline = opts.deadline ?? Date.now() + 50_000;
  const call = (sys: string, pr: string) => (p === "gemini" ? callGemini(sys, pr, opts.schema, deadline) : callOpenAiCompatible(sys, pr, deadline));
  const reply = await call(system, prompt);
  try {
    return { data: parseJsonLoose<T>(reply.text), model: reply.model };
  } catch {
    if (reply.truncated) throw new LlmError(MSG.truncated, 502);
    // One repair attempt: ask the model to return valid JSON only.
    if (deadline - Date.now() < 8000) throw new LlmError(MSG.invalid, 502);
    const fixed = await call("Return only valid JSON. No commentary.", `Fix this into valid JSON, keeping its content:\n${reply.text.slice(0, 12000)}`);
    return { data: parseJsonLoose<T>(fixed.text), model: reply.model };
  }
}
