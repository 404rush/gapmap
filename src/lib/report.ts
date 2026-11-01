// Markdown export of a full analysis, with every finding traceable to a source.
import { checkKey, type Checks } from "./checks";
import { formatDate, formatDateTime } from "./dates";
import { SOURCE_TYPE_LABEL } from "./sourceType";
import type { Analysis, Conflict } from "./types";

const STATUS_TEXT = {
  covered: "Covered by sources",
  thin: "Single source only",
  outdated: "Possibly outdated",
  contested: "Possible conflict",
  gap: "Potential gap",
} as const;

const REASON_TEXT = {
  "different-time": "likely different dates",
  "different-scope": "likely different scope",
  "different-definition": "likely different definitions",
  genuine: "genuine disagreement",
  unclear: "reason unclear",
} as const;

/** Markdown-safe single line. */
const md = (s: string) => s.replace(/\s+/g, " ").replace(/([*_`[\]<>])/g, "\\$1").trim();

export function buildReport(a: Analysis, checks: Checks = {}): string {
  const src = (id: string) => a.sources.find((s) => s.id === id);
  const tag = (id: string) => `S${id.replace(/\D/g, "")}`;
  const claimTag = (id: string) => tag(a.claims.find((c) => c.id === id)?.sourceId ?? id);
  const cite = (text: string) =>
    md(text).replace(/\\\[([a-z0-9,\s]+)\\\]/gi, (_, ids: string) => `[${ids.split(/[,\s]+/).filter(Boolean).map(claimTag).join(", ")}]`);
  const L = a.label;
  const aiSrc = new Set(a.sources.filter((s) => s.sourceType === "ai-answer").map((s) => s.id));
  const involvesAi = (c: Conflict) => c.claimIds.some((id) => aiSrc.has(a.claims.find((x) => x.id === id)?.sourceId ?? ""));
  const out: string[] = [];

  out.push(`# GapMap report`, "");
  out.push(`**Question:** ${md(a.question)}`, "");
  out.push(
    `Analysed ${formatDateTime(a.generatedAt)} · ${a.mode === "sample" ? "Sample sources (fictional demo data)" : "Live sources"}${a.model ? ` · AI: ${a.model}` : ""}`,
    "",
  );
  out.push(
    "> Findings are signals to verify, not verdicts. *Sourced* items are backed by a quote found word-for-word on the source page. Items marked *AI suggestion* were written by the AI from those quotes. Statuses and confidence are computed by fixed rules.",
    "",
  );

  out.push(`## Information Facts`, "");
  out.push(`- Sources reviewed: ${L.sourcesReviewed} (${L.independentOrigins} independent origins)${L.aiAnswers ? ` · AI answers audited: ${L.aiAnswers}` : ""}`);
  if (L.sourcesNotAnalysed) out.push(`- Sources that couldn't be analysed: ${L.sourcesNotAnalysed}`);
  out.push(
    `- Claims extracted: ${L.claims.total} — ${L.claims.verified} quoted word-for-word, ${L.claims.unverified} quote not found${L.aiAnswers ? `, ${L.claims.fromAiAnswer} from the AI answer` : ""}`,
  );
  out.push(`- AI-written notes: ${L.aiCount}`);
  out.push(`- Freshness: ${L.freshness.fresh} fresh, ${L.freshness.checkSoon} check soon, ${L.freshness.outdated} possibly outdated, ${L.freshness.undated} undated`);
  out.push(`- Possible conflicts between sources: ${L.conflicts.total} (${L.conflicts.explained} likely explained by dates, ${L.conflicts.unresolved} unresolved)`);
  if (L.aiAnswers) out.push(`- AI answer contradicted by sources: ${L.conflicts.withAiAnswer}`);
  out.push(`- Potential gaps: ${L.gaps} of ${L.expectedTopics} topics · Single source only: ${L.thinTopics} · Unanswered questions: ${L.openQuestions}`);
  out.push(`- Coverage: ${Math.round(L.coverage * 100)}% of topics have at least one source`);
  if (L.warnings.length) out.push(`- Warnings: ${L.warnings.join("; ")}`);
  out.push("");

  if (a.changes?.length) {
    out.push(`## Changes since the previous run`, "");
    for (const c of a.changes) {
      const q = a.subQuestions.find((x) => x.id === c.subQuestionId);
      out.push(`- ${md(q?.text ?? c.subQuestionId)}: ${STATUS_TEXT[c.from]} → **${STATUS_TEXT[c.to]}**${c.addedSourceIds.length ? ` (after adding ${c.addedSourceIds.map(tag).join(", ")})` : ""}`);
    }
    out.push("");
  }

  const done = a.checklist.filter((c) => checks[checkKey(c)]?.done).length;
  out.push(`## Verify next (${done} of ${a.checklist.length} done)`, "");
  for (const c of a.checklist) {
    const st = checks[checkKey(c)];
    out.push(`- [${st?.done ? "x" : " "}] **${c.priority.toUpperCase()}** — ${md(c.task)}${c.tag === "new" ? " *(new since last run)*" : ""}`);
    out.push(`  - Why: ${md(c.why)}`);
    out.push(`  - Where to verify: ${md(c.whereToVerify)}`);
    out.push(`  - Suggested search: \`${c.searchQuery.replace(/`/g, "'")}\``);
    if (c.askSource) out.push(`  - Message to the source: "${md(c.askSource)}"`);
    if (st?.note) out.push(`  - Your note: ${md(st.note)}`);
  }
  out.push("");

  out.push(`## Knowledge map`, "");
  for (const [i, q] of a.subQuestions.entries()) {
    const r = a.results.find((x) => x.subQuestionId === q.id)!;
    out.push(`### ${i + 1}. ${md(q.text)}`, "");
    out.push(`**Status:** ${STATUS_TEXT[r.status]} · **Confidence:** ${r.confidence} · **Importance:** ${q.importance}`, "");
    out.push(`- Why this status: ${r.reasons.join(" ")}`);
    out.push(`- Why this confidence: ${r.confidenceReasons.join(" ")}`, "");
    if (r.summary) out.push(`*AI suggestion:* ${cite(r.summary)}`, "");
    for (const c of a.claims.filter((x) => x.subQuestionId === q.id)) {
      const basis = aiSrc.has(c.sourceId) ? "From the AI answer (audited)" : c.verified ? "Sourced" : "Uncertain (quote not found on page)";
      out.push(`- ${basis} — ${md(c.claim)} (${tag(c.sourceId)})`);
      out.push(`  > "${c.quote.replace(/\s+/g, " ").trim()}"`);
    }
    out.push("");
  }

  const section = (title: string, list: Conflict[]) => {
    out.push(`## ${title}`, "");
    if (!list.length) out.push("None detected.", "");
    for (const c of list) {
      out.push(`- ${md(c.summary)} *(${REASON_TEXT[c.likelyReason]}; confidence ${c.confidence}; ${c.detectedBy === "rule" ? "found by the number check" : "AI suggestion"})*`);
      out.push(`  - Why they might differ: ${md(c.explanation)}`);
      out.push(`  - What would settle it: ${md(c.howToResolve)}`);
      out.push(`  - Claims: ${c.claimIds.map(claimTag).join(", ")}`);
    }
    out.push("");
  };
  section("Possible conflicts between sources", a.conflicts.filter((c) => !involvesAi(c)));
  if (aiSrc.size) section("AI answer vs sources", a.conflicts.filter(involvesAi));

  out.push(`## Dates and freshness`, "");
  if (!a.outdated.length) out.push("No dating problems found.");
  for (const o of a.outdated) out.push(`- ${tag(o.sourceId)} ${md(src(o.sourceId)?.title ?? "")}: ${md(o.reason)}${o.basis === "ai" ? " *(AI suggestion)*" : ""}`);
  out.push("");

  out.push(`## Unanswered questions`, "");
  if (!a.openQuestions.length) out.push("None raised.");
  for (const o of a.openQuestions) out.push(`- ${md(o.question)}${o.raisedBySourceIds.length ? ` (raised by ${o.raisedBySourceIds.map(tag).join(", ")})` : ""}`);
  out.push("");

  out.push(`## Sources`, "");
  for (const s of a.sources) {
    const st = a.sourceStatus[s.id];
    const date = s.sourceType === "ai-answer" ? "no date (AI answer)" : s.publishedDate ? `${s.dateLabel ?? "dated"} ${formatDate(s.publishedDate)}` : "undated";
    const notes = [
      s.isSample ? "fictional sample" : "",
      st?.status === "failed" ? `couldn't be analysed${st.error ? `: ${st.error}` : ""}` : "",
      st?.excerpted ? "analysed from excerpts" : "",
      s.via === "search-service" ? "text from the search service's copy" : "",
      s.userEdited?.type || s.userEdited?.date ? "type or date corrected by you" : "",
    ].filter(Boolean);
    out.push(`- **${tag(s.id)}** ${md(s.title)} — ${s.site} (${SOURCE_TYPE_LABEL[s.sourceType]}), ${date}${notes.length ? ` — ${notes.join("; ")}` : ""}${s.url ? ` — <${s.url}>` : ""}`);
  }
  for (const g of a.independence) out.push(`- ${g.sourceIds.map(tag).join(" and ")} share about ${Math.round(g.similarity * 100)}% of their wording and count as one origin.`);
  out.push("", "---", "Made with GapMap · ﹏𓊝﹏");
  return out.join("\n");
}
