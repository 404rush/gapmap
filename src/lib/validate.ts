// Runtime validation. AI replies are normalised field by field: a bad value
// falls back to a safe default instead of breaking the page, and malformed
// items are dropped. API request bodies are validated with limits.

import { z } from "zod";
import type { AiFindings, ChecklistOrigin, Importance, SubQuestion, Volatility } from "./types";

const str = z.string().catch("");
/** A field the item is useless without: the item is dropped if it's missing or blank. */
const need = z.string().trim().min(1);
const optStr = z.string().optional().catch(undefined);
const strArr = z.array(z.unknown()).catch([]).transform((xs) => xs.filter((x): x is string => typeof x === "string"));

/** An array whose items are validated one by one; invalid items are dropped. */
function list<T extends z.ZodType>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((xs) =>
      xs.flatMap((x) => {
        const r = item.safeParse(x);
        return r.success ? [r.data as z.output<T>] : [];
      }),
    );
}

export const IMPORTANCE = ["critical", "important", "optional"] as const satisfies readonly Importance[];
export const VOLATILITY = ["fast", "medium", "slow"] as const satisfies readonly Volatility[];
const REASONS = ["different-time", "different-scope", "different-definition", "genuine", "unclear"] as const;
const CONFIDENCE = ["low", "medium", "high"] as const;
const ORIGINS = ["gap", "conflict", "outdated", "open-question", "single-source", "general"] as const satisfies readonly ChecklistOrigin[];

/** Map common synonyms the model might use onto our priority words. */
const priority = z
  .unknown()
  .transform((v) => {
    const s = String(v ?? "").toLowerCase().trim();
    if (["critical", "high", "urgent", "must", "essential"].includes(s)) return "critical";
    if (["optional", "low", "nice to have", "minor"].includes(s)) return "optional";
    return "important";
  })
  .pipe(z.enum(IMPORTANCE));

export const AiFindingsSchema = z
  .object({
    summaries: list(z.object({ subQuestionId: need, summary: need })),
    conflicts: list(
      z.object({
        subQuestionId: str,
        claimIds: strArr,
        summary: need,
        likelyReason: z.enum(REASONS).catch("unclear"),
        explanation: str,
        howToResolve: str,
        confidence: z.enum(CONFIDENCE).catch("medium"),
      }),
    ),
    outdated: list(z.object({ sourceId: need, claimId: optStr, reason: need })),
    openQuestions: list(z.object({ question: need, raisedBySourceIds: strArr, subQuestionId: optStr })),
    checklist: list(
      z.object({
        priority,
        task: need,
        whereToVerify: str,
        searchQuery: str,
        why: str,
        askSource: optStr,
        relatedIds: strArr,
        origin: z.enum(ORIGINS).catch("general"),
      }),
    ),
  })
  .catch({ summaries: [], conflicts: [], outdated: [], openQuestions: [], checklist: [] });

export function normalizeAiFindings(raw: unknown): AiFindings {
  return AiFindingsSchema.parse(raw ?? {});
}

export const PlanReplySchema = z.object({
  subQuestions: list(
    z.object({
      text: need,
      importance: priority,
      volatility: z.enum(VOLATILITY).catch("medium"),
      why: str,
    }),
  ),
});

export const ExtractReplySchema = z.object({
  claims: list(z.object({ subQuestionId: need, claim: need, quote: need, timeReference: optStr })),
  raisedQuestions: strArr,
});

// ——— Request bodies ———

export const LIMITS = { question: 600, topics: 10, sources: 10, text: 60_000, claims: 240 };

const SubQuestionBody = z.object({
  id: z.string().max(12),
  text: z.string().max(200),
  importance: z.enum(IMPORTANCE),
  volatility: z.enum(VOLATILITY),
  why: z.string().max(400).catch(""),
});

export const SourceBody = z.object({
  id: z.string().max(12),
  kind: z.enum(["url", "text", "pdf", "sample"]),
  url: z.string().max(2000).optional(),
  title: z.string().max(300),
  site: z.string().max(200),
  sourceType: z.string().max(20),
  publishedDate: z.string().max(10).optional(),
  dateLabel: z.string().max(40).optional(),
  dateEvidence: z.string().max(200).optional(),
  dateConfidence: z.enum(["found", "inferred", "none"]),
  cycleMentions: z.array(z.string().max(10)).max(40),
  text: z.string().max(LIMITS.text),
  fetchedAt: z.string().max(40),
  via: z.string().max(20).optional(),
  isSample: z.boolean().optional(),
  note: z.string().max(400).optional(),
  userEdited: z.object({ type: z.boolean().optional(), date: z.boolean().optional() }).optional(),
});

const ClaimBody = z.object({
  id: z.string().max(20),
  sourceId: z.string().max(12),
  subQuestionId: z.string().max(12),
  claim: z.string().max(600),
  quote: z.string().max(1200),
  timeReference: z.string().max(120).optional(),
  verified: z.boolean(),
  matchKind: z.enum(["exact", "ignoring-punctuation"]).optional(),
  matchStart: z.number().optional(),
  matchEnd: z.number().optional(),
});

export const PlanBody = z.object({ question: z.string().trim().min(8, "Write a question of at least a few words.").max(LIMITS.question) });

export const ExtractBody = z.object({
  question: z.string().min(1).max(LIMITS.question),
  subQuestions: z.array(SubQuestionBody).min(1).max(LIMITS.topics),
  source: SourceBody,
});

export const AnalyzeBody = z.object({
  question: z.string().min(1).max(LIMITS.question),
  subQuestions: z.array(SubQuestionBody).min(1).max(LIMITS.topics),
  sources: z.array(SourceBody).min(1).max(LIMITS.sources),
  claims: z.array(ClaimBody).max(LIMITS.claims),
  raisedQuestions: z.array(z.object({ sourceId: z.string().max(12), question: z.string().max(300) })).max(60).catch([]),
  sourceStatus: z
    .record(z.string(), z.object({ status: z.enum(["ok", "no-claims", "failed"]), error: z.string().max(400).optional(), excerpted: z.boolean().optional(), cached: z.boolean().optional() }))
    .catch({}),
});

export const SourceJsonBody = z.object({
  id: z.string().max(12).default("s0"),
  url: z.string().max(2000).optional(),
  text: z.string().max(LIMITS.text * 2).optional(),
  title: z.string().max(300).optional(),
  date: z.string().max(40).optional(),
  isAiAnswer: z.boolean().optional(),
  /** Page text supplied by the search service, used if the site can't be read directly. */
  fallbackText: z.string().max(LIMITS.text * 2).optional(),
  fallbackTitle: z.string().max(300).optional(),
  fallbackDate: z.string().max(40).optional(),
});

export const SearchBody = z.object({ query: z.string().trim().min(1, "Enter something to search for.").max(300) });

/** Drop topics the user left empty. */
export function cleanTopics(qs: SubQuestion[]): SubQuestion[] {
  return qs.filter((q) => q.text.trim().length > 0).map((q) => ({ ...q, text: q.text.trim() }));
}

export function firstIssue(e: z.ZodError): string {
  const i = e.issues[0];
  if (!i) return "The request was not valid.";
  if (i.code === "too_big") return "That's too much text for one request. Try fewer or shorter sources.";
  return i.message && !/^Invalid|^Expected/.test(i.message) ? i.message : `The request was not valid (${i.path.join(".") || "body"}).`;
}
