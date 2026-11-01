import { fail, fromError, ok, readBody } from "@/lib/server/http";
import { llmJson } from "@/lib/server/llm";
import { PLAN_SCHEMA, SYSTEM_BASE, planPrompt } from "@/lib/server/prompts";
import { rateLimit, tooLarge } from "@/lib/server/rateLimit";
import type { SubQuestion } from "@/lib/types";
import { PlanBody, PlanReplySchema } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(req: Request) {
  const limited = tooLarge(req, 10_000) ?? rateLimit(req, "ai");
  if (limited) return limited;
  try {
    const { question } = await readBody(req, PlanBody);
    const today = new Date().toISOString().slice(0, 10);
    const { data, model } = await llmJson<unknown>(SYSTEM_BASE, planPrompt(question, today), { schema: PLAN_SCHEMA, deadline: Date.now() + 52_000 });
    const subQuestions: SubQuestion[] = PlanReplySchema.parse(data ?? {})
      .subQuestions.filter((q) => q.text.trim())
      .slice(0, 8)
      .map((q, i) => ({ id: `q${i + 1}`, text: q.text.trim().slice(0, 200), importance: q.importance, volatility: q.volatility, why: q.why.trim().slice(0, 300) }));
    if (subQuestions.length < 2) return fail("The AI couldn't break this question down. Try rephrasing it.", 502);
    return ok({ subQuestions, model });
  } catch (e) {
    return fromError(e);
  }
}
