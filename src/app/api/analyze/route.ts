import { assembleAnalysis } from "@/lib/assemble";
import { fail, fromError, ok, readBody } from "@/lib/server/http";
import { llmJson } from "@/lib/server/llm";
import { ANALYZE_SCHEMA, SYSTEM_BASE, analyzePrompt } from "@/lib/server/prompts";
import { rateLimit, tooLarge } from "@/lib/server/rateLimit";
import { SOURCE_TYPE_LABEL } from "@/lib/sourceType";
import type { Claim, Source, SourceType } from "@/lib/types";
import { AnalyzeBody, cleanTopics } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = tooLarge(req, 3.5 * 1024 * 1024) ?? rateLimit(req, "ai");
  if (limited) return limited;
  try {
    const body = await readBody(req, AnalyzeBody);
    const subQuestions = cleanTopics(body.subQuestions);
    if (!subQuestions.length) return fail("The coverage plan is empty.");
    const sources = body.sources as Source[];
    const claims = body.claims as Claim[];
    const now = new Date();
    const failedNote = (id: string) => (body.sourceStatus[id]?.status === "failed" ? "could not be analysed" : undefined);
    const { data, model } = await llmJson<unknown>(
      SYSTEM_BASE,
      analyzePrompt({
        question: body.question,
        today: now.toISOString().slice(0, 10),
        subQuestions,
        sources: sources.map((s) => ({
          id: s.id,
          title: s.title,
          site: s.site,
          type: SOURCE_TYPE_LABEL[s.sourceType as SourceType] ?? "Website",
          date: s.publishedDate,
          note: failedNote(s.id),
        })),
        claims,
        raisedQuestions: body.raisedQuestions,
      }),
      { schema: ANALYZE_SCHEMA, deadline: Date.now() + 52_000 },
    );
    const analysis = assembleAnalysis({
      question: body.question,
      subQuestions,
      sources,
      claims,
      ai: data,
      raisedQuestions: body.raisedQuestions,
      sourceStatus: body.sourceStatus,
      now,
      mode: "live",
      model,
    });
    return ok({ analysis });
  } catch (e) {
    return fromError(e);
  }
}
