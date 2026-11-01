import { selectExcerpts } from "@/lib/excerpt";
import { fromError, ok, readBody } from "@/lib/server/http";
import { llmJson } from "@/lib/server/llm";
import { EXTRACT_SCHEMA, SYSTEM_BASE, extractPrompt } from "@/lib/server/prompts";
import { rateLimit, tooLarge } from "@/lib/server/rateLimit";
import { verifyQuote } from "@/lib/quotes";
import { SOURCE_TYPE_LABEL } from "@/lib/sourceType";
import type { Claim, SourceType } from "@/lib/types";
import { ExtractBody, ExtractReplySchema, cleanTopics } from "@/lib/validate";

export const maxDuration = 60;

const PROMPT_TEXT_LIMIT = 24_000;

export async function POST(req: Request) {
  const limited = tooLarge(req, 400_000) ?? rateLimit(req, "ai");
  if (limited) return limited;
  try {
    const body = await readBody(req, ExtractBody);
    const subQuestions = cleanTopics(body.subQuestions);
    const source = body.source;
    const today = new Date().toISOString().slice(0, 10);
    const { text, excerpted } = selectExcerpts(source.text, [body.question, ...subQuestions.map((q) => q.text)], PROMPT_TEXT_LIMIT);
    const { data, model } = await llmJson<unknown>(
      SYSTEM_BASE,
      extractPrompt({
        question: body.question,
        today,
        subQuestions,
        source: { id: source.id, title: source.title, site: source.site, type: SOURCE_TYPE_LABEL[source.sourceType as SourceType] ?? "Website", date: source.publishedDate },
        text,
        excerpted,
      }),
      { schema: EXTRACT_SCHEMA, deadline: Date.now() + 52_000 },
    );
    const reply = ExtractReplySchema.parse(data ?? {});
    const valid = new Set(subQuestions.map((q) => q.id));
    const seen = new Set<string>();
    const claims: Claim[] = [];
    for (const c of reply.claims) {
      if (!c.claim.trim() || !c.quote.trim() || !valid.has(c.subQuestionId)) continue;
      const key = `${c.subQuestionId}|${c.quote.trim().toLowerCase()}`;
      if (seen.has(key) || claims.length >= 12) continue;
      seen.add(key);
      // Verbatim check against the FULL page text, not the AI's memory of it.
      const m = verifyQuote(source.text, c.quote);
      claims.push({
        id: `${source.id}c${claims.length + 1}`,
        sourceId: source.id,
        subQuestionId: c.subQuestionId,
        claim: c.claim.trim().slice(0, 400),
        quote: c.quote.trim().slice(0, 800),
        timeReference: c.timeReference?.trim() || undefined,
        verified: m.verified,
        matchKind: m.kind,
        matchStart: m.start,
        matchEnd: m.end,
      });
    }
    const raisedQuestions = reply.raisedQuestions.map((q) => q.trim()).filter(Boolean).slice(0, 3);
    return ok({ claims, raisedQuestions, excerpted, model });
  } catch (e) {
    return fromError(e);
  }
}
