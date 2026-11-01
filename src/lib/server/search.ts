// Web search via Tavily (free tier). Optional: users can always add URLs by hand.
// Results include Tavily's own copy of each page, used as a fallback when a
// site won't let GapMap read it directly.

import { LlmError } from "./llm";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  /** The search service's copy of the page text, if it has one. */
  content?: string;
}

export function searchEnabled(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

export async function webSearch(query: string, maxResults = 8): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new LlmError("Search isn't set up. Add TAVILY_API_KEY to the environment, or add links by hand.", 400);
  let res: Response;
  try {
    res = await fetch(`${(process.env.TAVILY_API_BASE || "https://api.tavily.com").replace(/\/+$/, "")}/search`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", include_answer: false, include_raw_content: "text" }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new LlmError("The search service didn't respond. Try again, or add links by hand.", 503);
  }
  if (res.status === 401 || res.status === 403) throw new LlmError("The Tavily key was rejected. Check TAVILY_API_KEY, or add links by hand.", 401);
  if (res.status === 429 || res.status === 432) throw new LlmError("The free search quota is used up for now. Add links by hand.", 429);
  if (!res.ok) throw new LlmError(`Search failed (${res.status}). Add links by hand.`, 502);
  const data = await res.json();
  return (data?.results ?? [])
    .filter((r: { url?: string }) => typeof r.url === "string" && /^https?:\/\//.test(r.url))
    .map((r: { title?: string; url: string; content?: string; raw_content?: string | null; published_date?: string }) => ({
      title: (r.title || r.url).slice(0, 200),
      url: r.url,
      snippet: (r.content || "").slice(0, 280),
      publishedDate: r.published_date,
      content: (r.raw_content || "").slice(0, 60_000) || undefined,
    }));
}
