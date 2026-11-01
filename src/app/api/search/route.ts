import { fromError, ok, readBody } from "@/lib/server/http";
import { rateLimit, tooLarge } from "@/lib/server/rateLimit";
import { webSearch } from "@/lib/server/search";
import { SearchBody } from "@/lib/validate";

export const maxDuration = 30;

export async function POST(req: Request) {
  const limited = tooLarge(req, 5_000) ?? rateLimit(req, "search");
  if (limited) return limited;
  try {
    const { query } = await readBody(req, SearchBody);
    return ok({ results: await webSearch(query) });
  } catch (e) {
    return fromError(e);
  }
}
