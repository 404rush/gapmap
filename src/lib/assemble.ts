// The deterministic layer. The AI proposes summaries, conflicts and a
// checklist; this file validates them, checks them against the evidence, adds
// the signals that don't need AI (dates, cycles, copies, numbers, missing
// coverage), decides each topic's status and confidence from evidence, and
// computes the Information Facts label. Runs identically in the browser
// (sample mode) and on the server.  ﹏𓊝﹏

import { cycleEndDate, cycleEnded, formatDate, monthsBetween } from "./dates";
import { independenceGroups } from "./independence";
import { numericConflicts } from "./numbers";
import { containsQuote } from "./quotes";
import { SOURCE_TYPE_LABEL } from "./sourceType";
import type {
  AiFindings,
  Analysis,
  ChecklistItem,
  Claim,
  Confidence,
  Conflict,
  Freshness,
  Importance,
  LabelStats,
  NodeStatus,
  OpenQuestion,
  OutdatedSignal,
  Source,
  SourceMeta,
  SourceRunStatus,
  SubQuestion,
  SubQuestionResult,
  Volatility,
} from "./types";
import { normalizeAiFindings } from "./validate";

// Months after which a fact of each volatility is "check soon" / "outdated".
export const THRESHOLDS: Record<Volatility, [number, number]> = {
  fast: [6, 12],
  medium: [12, 24],
  slow: [36, 60],
};
const VOL_RANK: Record<Volatility, number> = { fast: 0, medium: 1, slow: 2 };
const PRIORITY_RANK: Record<Importance, number> = { critical: 0, important: 1, optional: 2 };
const ORIGIN_RANK: Record<string, number> = { gap: 0, conflict: 1, outdated: 2, "single-source": 3, "open-question": 4, general: 5 };

export function freshnessFor(date: string | undefined, vol: Volatility, now: Date): Freshness {
  if (!date) return "undated";
  const m = monthsBetween(date, now);
  const [soon, old] = THRESHOLDS[vol];
  if (m >= old) return "outdated";
  if (m >= soon) return "check-soon";
  return "fresh";
}

export function toMeta(s: Source): SourceMeta {
  const { text, ...rest } = s;
  return { ...rest, chars: text.length };
}

const tag = (id: string) => `S${id.replace(/\D/g, "")}`;
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function similar(a: string, b: string): boolean {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return norm(a) === norm(b);
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter) >= 0.6;
}

export interface AssembleInput {
  question: string;
  subQuestions: SubQuestion[];
  sources: Source[];
  claims: Claim[];
  ai: AiFindings | unknown;
  raisedQuestions?: { sourceId: string; question: string }[];
  sourceStatus?: Record<string, SourceRunStatus>;
  now: Date;
  mode: "live" | "sample";
  scenario?: string;
  model?: string;
}

export function assembleAnalysis(input: AssembleInput): Analysis {
  const { question, subQuestions, sources, now, mode } = input;
  const ai = normalizeAiFindings(input.ai);
  const sqById = new Map(subQuestions.map((q) => [q.id, q]));
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const claims = input.claims.filter((c) => srcById.has(c.sourceId) && sqById.has(c.subQuestionId));
  const claimById = new Map(claims.map((c) => [c.id, c]));
  const aiSrc = new Set(sources.filter((s) => s.sourceType === "ai-answer").map((s) => s.id));
  const isAiClaim = (id: string) => aiSrc.has(claimById.get(id)?.sourceId ?? "");

  const sourceStatus: Record<string, SourceRunStatus> = {};
  for (const s of sources) {
    const given = input.sourceStatus?.[s.id];
    const n = claims.filter((c) => c.sourceId === s.id).length;
    sourceStatus[s.id] = given ?? { status: n ? "ok" : "no-claims" };
    if (sourceStatus[s.id].status === "ok" && !n) sourceStatus[s.id] = { ...sourceStatus[s.id], status: "no-claims" };
  }

  // 1. Independence (copied / near-duplicate sources share one origin). AI answers are never an origin.
  const indep = independenceGroups(sources.filter((s) => !aiSrc.has(s.id)).map((s) => ({ id: s.id, text: s.text })));
  const originKey = (sourceId: string) => (aiSrc.has(sourceId) ? `ai:${sourceId}` : `g${indep.originOf[sourceId]}`);

  // 2. Freshness per source, judged against the fastest-changing topic it informs
  const freshnessBySource: Record<string, Freshness> = {};
  for (const s of sources) {
    const vols = claims
      .filter((c) => c.sourceId === s.id && c.verified)
      .map((c) => sqById.get(c.subQuestionId)?.volatility ?? "medium");
    const vol = vols.sort((a, b) => VOL_RANK[a] - VOL_RANK[b])[0] ?? "medium";
    freshnessBySource[s.id] = freshnessFor(s.publishedDate, vol, now);
  }

  // 3. Outdated / undated signals that need no AI
  const outdated: OutdatedSignal[] = [];
  let oid = 1;
  for (const s of sources) {
    if (aiSrc.has(s.id)) continue;
    const f = freshnessBySource[s.id];
    if (f === "undated") {
      outdated.push({ id: `o${oid++}`, sourceId: s.id, kind: "undated", reason: "No publish or update date found, so its claims can't be checked for freshness.", basis: "uncertain" });
    } else if (f === "outdated" || f === "check-soon") {
      const months = Math.round(monthsBetween(s.publishedDate!, now));
      outdated.push({
        id: `o${oid++}`,
        sourceId: s.id,
        kind: f === "outdated" ? "old-date" : "check-soon",
        reason:
          f === "outdated"
            ? `Dated ${months} months ago — older than the topics it covers usually stay reliable.`
            : `Dated ${months} months ago — probably still right, but worth re-checking.`,
        basis: "sourced",
      });
    }
    if (s.cycleMentions.length) {
      const latest = [...s.cycleMentions].sort().at(-1)!;
      const datedAfter = s.publishedDate && s.publishedDate >= cycleEndDate(latest);
      if (cycleEnded(latest, now) && !datedAfter) {
        outdated.push({
          id: `o${oid++}`,
          sourceId: s.id,
          kind: "old-cycle",
          reason: `The most recent cycle it mentions is ${latest}, which has already ended.`,
          basis: "sourced",
        });
      }
    }
  }
  const seenSuperseded = new Set<string>();
  for (const o of ai.outdated) {
    if (!srcById.has(o.sourceId) || !o.reason.trim()) continue;
    const claimId = o.claimId && claimById.get(o.claimId)?.sourceId === o.sourceId ? o.claimId : undefined;
    const key = `${o.sourceId}:${claimId ?? ""}`;
    if (seenSuperseded.has(key)) continue;
    seenSuperseded.add(key);
    outdated.push({ id: `o${oid++}`, sourceId: o.sourceId, claimId, kind: "superseded", reason: o.reason, basis: "ai" });
  }

  // 4. Conflicts: AI proposals kept only if they cite real claims from ≥2 sources, then the rule-based number check.
  const conflicts: Conflict[] = [];
  const conflictKeys = new Set<string>();
  for (const c of ai.conflicts) {
    const ids = [...new Set(c.claimIds.filter((id) => claimById.has(id)))];
    const srcs = new Set(ids.map((id) => claimById.get(id)!.sourceId));
    if (ids.length < 2 || srcs.size < 2) continue;
    const key = [...ids].sort().join("|");
    if (conflictKeys.has(key)) continue;
    conflictKeys.add(key);
    const sq = sqById.has(c.subQuestionId) ? c.subQuestionId : claimById.get(ids[0])!.subQuestionId;
    const anyUnverified = ids.some((id) => !claimById.get(id)!.verified);
    conflicts.push({
      ...c,
      summary: c.summary || "These sources make claims that may not all be right at the same time.",
      id: "",
      subQuestionId: sq,
      claimIds: ids,
      confidence: anyUnverified ? "low" : c.confidence,
      detectedBy: "ai",
    });
  }
  for (const r of numericConflicts({ claims, sources: srcById, existing: conflicts, originOf: originKey })) conflicts.push({ ...r, id: "" });
  conflicts.forEach((c, i) => (c.id = `x${i + 1}`));
  const conflictById = new Map(conflicts.map((c) => [c.id, c]));
  const involvesAi = (c: Conflict) => c.claimIds.some(isAiClaim);

  // 5. Per-topic status, confidence and newest evidence — decided from evidence, not by the AI.
  const summaryById = new Map(ai.summaries.map((s) => [s.subQuestionId, s.summary]));
  const results: SubQuestionResult[] = subQuestions.map((q) => {
    const all = claims.filter((c) => c.subQuestionId === q.id);
    const verified = all.filter((c) => c.verified && !aiSrc.has(c.sourceId));

    // Origins: copied sources share one; a claim whose exact wording also appears in another source is an echo.
    const parent = new Map<string, string>();
    const find = (k: string): string => {
      const p = parent.get(k) ?? k;
      if (p === k) return k;
      const r = find(p);
      parent.set(k, r);
      return r;
    };
    for (let i = 0; i < verified.length; i++)
      for (let j = i + 1; j < verified.length; j++) {
        const a = verified[i];
        const b = verified[j];
        const ka = find(originKey(a.sourceId));
        const kb = find(originKey(b.sourceId));
        if (ka === kb) continue;
        if (containsQuote(srcById.get(b.sourceId)!.text, a.quote) || containsQuote(srcById.get(a.sourceId)!.text, b.quote)) parent.set(ka, kb);
      }
    const origins = new Set(verified.map((c) => find(originKey(c.sourceId))));

    const qConf = conflicts.filter((c) => c.subQuestionId === q.id && !involvesAi(c));
    const unresolved = qConf.filter((c) => c.likelyReason !== "different-time");
    // Newest dated evidence, preferring an official source when one is dated.
    const dated = verified.filter((c) => srcById.get(c.sourceId)!.publishedDate);
    const byDate = (a: Claim, b: Claim) => (srcById.get(b.sourceId)!.publishedDate! > srcById.get(a.sourceId)!.publishedDate! ? 1 : -1);
    const officialDated = dated.filter((c) => srcById.get(c.sourceId)!.sourceType === "official").sort(byDate);
    const newest = officialDated[0] ?? dated.sort(byDate)[0];
    const newestSrc = newest ? srcById.get(newest.sourceId)! : undefined;

    const reasons: string[] = [];
    let status: NodeStatus;
    if (verified.length === 0) {
      status = "gap";
      const aiOnly = all.length && all.every((c) => aiSrc.has(c.sourceId));
      reasons.push(
        aiOnly
          ? "Only the pasted AI answer mentions this; no reviewed source does."
          : all.length
            ? `${all.length} mention${all.length > 1 ? "s" : ""} found, but none could be matched to the page text.`
            : "None of the reviewed sources address this.",
      );
    } else if (unresolved.length) {
      status = "contested";
      reasons.push(`${unresolved.length} possible conflict${unresolved.length > 1 ? "s" : ""} between sources.`);
    } else if (qConf.length) {
      status = "outdated";
      reasons.push("Sources disagree, most likely because some describe an earlier time.");
    } else if (verified.every((c) => ["outdated", "undated"].includes(freshnessBySource[c.sourceId]))) {
      status = "outdated";
      reasons.push("Every source that covers this is old or undated.");
    } else if (origins.size <= 1) {
      status = "thin";
      reasons.push("Backed by only one independent source.");
    } else {
      status = "covered";
      reasons.push(`Supported by ${origins.size} independent sources with no conflict detected.`);
    }
    if (verified.length && origins.size < new Set(verified.map((c) => c.sourceId)).size) {
      reasons.push("Some supporting sources appear to repeat each other, so they count as one.");
    }
    if (newestSrc && (status === "outdated" || status === "contested")) {
      reasons.push(
        `Newest ${newestSrc.sourceType === "official" ? "official" : "dated"} source: ${tag(newestSrc.id)} (${(newestSrc.dateLabel ?? "dated").toLowerCase()} ${formatDate(newestSrc.publishedDate)}).`,
      );
    }

    // Confidence: how far the evidence can be relied on.
    const official = verified.some((c) => srcById.get(c.sourceId)!.sourceType === "official");
    const fresh = verified.some((c) => freshnessBySource[c.sourceId] === "fresh");
    const newestIsStrong = !!newestSrc && (newestSrc.sourceType === "official" || freshnessBySource[newestSrc.id] === "fresh");
    let confidence: Confidence;
    const confidenceReasons: string[] = [];
    if (status === "gap") {
      confidence = "low";
      confidenceReasons.push("No reviewed source answers this.");
    } else if (status === "contested") {
      confidence = "low";
      confidenceReasons.push("Sources disagree and the reason isn't clear.");
    } else if (status === "outdated") {
      confidence = newestIsStrong ? "medium" : "low";
      confidenceReasons.push(newestIsStrong ? "A newer, stronger source exists, but older sources still say otherwise." : "Coverage is old, undated or disputed by date.");
    } else if (status === "thin") {
      confidence = official && fresh ? "medium" : "low";
      confidenceReasons.push(official && fresh ? "One recent official source, not yet confirmed elsewhere." : "Only one independent source.");
    } else {
      confidence = (official || origins.size >= 3) && fresh ? "high" : "medium";
      confidenceReasons.push(`${origins.size} independent sources agree.`);
      if (official) confidenceReasons.push("Includes an official source.");
      if (!fresh) confidenceReasons.push("None of the sources is recently dated.");
    }

    return {
      subQuestionId: q.id,
      status,
      summary: summaryById.get(q.id) ?? "",
      claimIds: all.map((c) => c.id),
      reasons,
      independentOrigins: origins.size,
      confidence,
      confidenceReasons,
      newestClaimId: newest?.id,
    };
  });
  const resultById = new Map(results.map((r) => [r.subQuestionId, r]));

  // 6. Open questions raised (but not answered) by the sources, deduplicated
  const openQuestions: OpenQuestion[] = [];
  const addOpen = (question: string, raisedBy: string[], subQuestionId?: string) => {
    const q = question.trim();
    if (!q || openQuestions.some((o) => similar(o.question, q)) || openQuestions.length >= 8) return;
    openQuestions.push({
      id: `u${openQuestions.length + 1}`,
      question: q,
      raisedBySourceIds: [...new Set(raisedBy.filter((id) => srcById.has(id)))],
      subQuestionId: subQuestionId && sqById.has(subQuestionId) ? subQuestionId : undefined,
    });
  };
  for (const o of ai.openQuestions) addOpen(o.question, o.raisedBySourceIds, o.subQuestionId);
  // The AI is asked to merge the questions sources raised; fall back to them only if it returned none.
  if (!ai.openQuestions.length) for (const r of input.raisedQuestions ?? []) addOpen(r.question, [r.sourceId]);

  // 7. Checklist: AI items, validated and deduplicated, plus rule-based items so every critical problem has one
  const topicOf = (id: string): string | undefined =>
    sqById.has(id) ? id : (claimById.get(id)?.subQuestionId ?? conflictById.get(id)?.subQuestionId);
  const checklist: ChecklistItem[] = [];
  for (const c of ai.checklist) {
    if (!c.task.trim() || checklist.some((x) => similar(x.task, c.task))) continue;
    const topicIds = [...new Set(c.relatedIds.map(topicOf).filter((x): x is string => !!x))];
    checklist.push({ ...c, id: "", topicIds, searchQuery: c.searchQuery || c.task, whereToVerify: c.whereToVerify || "The official source for this topic" });
  }
  const questionWords = norm(question)
    .split(" ")
    .filter((w) => w.length > 3 && !["what", "should", "verify", "before", "which", "where", "about", "there", "their"].includes(w))
    .slice(0, 5)
    .join(" ");
  for (const r of results) {
    const q = sqById.get(r.subQuestionId)!;
    if (checklist.some((c) => c.topicIds.includes(q.id))) continue;
    const needs =
      r.status === "gap" ||
      r.status === "contested" ||
      (r.status === "thin" && q.importance === "critical") ||
      (r.status === "outdated" && q.importance !== "optional");
    if (!needs) continue;
    checklist.push({
      id: "",
      priority: q.importance,
      task:
        r.status === "gap"
          ? `Find a reliable source that answers: ${q.text}`
          : r.status === "contested"
            ? `Resolve the disagreement on: ${q.text}`
            : r.status === "outdated"
              ? `Confirm the current answer with the newest official source: ${q.text}`
              : `Confirm with a second, independent source: ${q.text}`,
      whereToVerify: "The official or primary source for this topic",
      searchQuery: `${questionWords} ${q.text.replace(/\?$/, "")}`.trim().slice(0, 110),
      why: q.why || "Added by GapMap's rules because this topic isn't settled by the sources.",
      relatedIds: [q.id],
      topicIds: [q.id],
      origin: r.status === "gap" ? "gap" : r.status === "contested" ? "conflict" : r.status === "outdated" ? "outdated" : "single-source",
    });
  }
  // Priority floor: anything tied to a critical gap or conflict is critical.
  for (const item of checklist) {
    for (const t of item.topicIds) {
      const r = resultById.get(t);
      if (r && sqById.get(t)!.importance === "critical" && (r.status === "gap" || r.status === "contested")) item.priority = "critical";
    }
  }
  checklist.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (ORIGIN_RANK[a.origin] ?? 9) - (ORIGIN_RANK[b.origin] ?? 9));
  checklist.forEach((c, i) => (c.id = `k${i + 1}`));

  // 8. Information Facts label
  const label = computeLabel({ subQuestions, sources, claims, conflicts, outdated, openQuestions, results, checklist, freshnessBySource, indep, aiSrc, sourceStatus, ai });

  return {
    question,
    generatedAt: now.toISOString(),
    mode,
    scenario: input.scenario,
    model: input.model,
    subQuestions,
    sources: sources.map(toMeta),
    sourceStatus,
    claims,
    conflicts,
    outdated,
    openQuestions,
    results,
    checklist,
    independence: indep.groups,
    label,
    freshnessBySource,
  };
}

function computeLabel(a: {
  subQuestions: SubQuestion[];
  sources: Source[];
  claims: Claim[];
  conflicts: Conflict[];
  outdated: OutdatedSignal[];
  openQuestions: OpenQuestion[];
  results: SubQuestionResult[];
  checklist: ChecklistItem[];
  freshnessBySource: Record<string, Freshness>;
  indep: { independentOrigins: number; groups: { sourceIds: string[] }[] };
  aiSrc: Set<string>;
  sourceStatus: Record<string, SourceRunStatus>;
  ai: AiFindings;
}): LabelStats {
  const { aiSrc } = a;
  const claimSrc = new Map(a.claims.map((c) => [c.id, c.sourceId]));
  const fromAiAnswer = a.claims.filter((c) => aiSrc.has(c.sourceId)).length;
  const verified = a.claims.filter((c) => c.verified && !aiSrc.has(c.sourceId)).length;
  const unverified = a.claims.filter((c) => !c.verified && !aiSrc.has(c.sourceId)).length;
  const involvesAi = (c: Conflict) => c.claimIds.some((id) => aiSrc.has(claimSrc.get(id) ?? ""));
  const sourceConflicts = a.conflicts.filter((c) => !involvesAi(c));
  const withAiAnswer = a.conflicts.length - sourceConflicts.length;
  const lowConf = a.conflicts.filter((c) => c.confidence === "low").length;
  const aiItems = {
    summaries: a.results.filter((r) => r.summary).length,
    conflicts: a.conflicts.filter((c) => c.detectedBy === "ai").length,
    openQuestions: a.openQuestions.length,
    checklist: a.checklist.length,
    notes: a.outdated.filter((o) => o.basis === "ai").length,
  };
  const aiCount = Object.values(aiItems).reduce((x, y) => x + y, 0);

  const fresh = { fresh: 0, checkSoon: 0, outdated: 0, undated: 0 };
  for (const s of a.sources) {
    if (aiSrc.has(s.id)) continue;
    const f = a.freshnessBySource[s.id];
    if (f === "fresh") fresh.fresh++;
    else if (f === "check-soon") fresh.checkSoon++;
    else if (f === "outdated") fresh.outdated++;
    else fresh.undated++;
  }
  const explained = sourceConflicts.filter((c) => c.likelyReason === "different-time").length;
  const gaps = a.results.filter((r) => r.status === "gap").length;
  const thin = a.results.filter((r) => r.status === "thin").length;
  const notAnalysed = Object.values(a.sourceStatus).filter((s) => s.status === "failed").length;
  const excerpted = Object.values(a.sourceStatus).filter((s) => s.excerpted).length;

  const warnings: string[] = [];
  const oldSources = new Set(a.outdated.filter((o) => o.kind === "old-cycle" || o.kind === "old-date").map((o) => o.sourceId));
  if (oldSources.size) warnings.push(`${oldSources.size} source${oldSources.size > 1 ? "s" : ""} may be outdated`);
  if (fresh.undated) warnings.push(`${fresh.undated} source${fresh.undated > 1 ? "s have" : " has"} no date`);
  if (thin) warnings.push(`${thin} topic${thin > 1 ? "s rely" : " relies"} on a single source`);
  if (unverified) warnings.push(`${unverified} claim${unverified > 1 ? "s" : ""} couldn't be matched to page text`);
  for (const g of a.indep.groups) warnings.push(`${g.sourceIds.map(tag).join(" and ")} appear to share one origin`);
  if (notAnalysed) warnings.push(`${notAnalysed} source${notAnalysed > 1 ? "s" : ""} couldn't be analysed`);
  if (excerpted) warnings.push(`${excerpted} long source${excerpted > 1 ? "s were" : " was"} analysed from excerpts`);
  if (aiSrc.size)
    warnings.push(withAiAnswer ? `the pasted AI answer is contradicted ${withAiAnswer} time${withAiAnswer > 1 ? "s" : ""}` : "includes a pasted AI answer (audited, not used as evidence)");

  const ingredients: Record<string, number> = {};
  for (const s of a.sources) {
    if (aiSrc.has(s.id)) continue;
    const k = SOURCE_TYPE_LABEL[s.sourceType];
    ingredients[k] = (ingredients[k] ?? 0) + 1;
  }

  return {
    sourcesReviewed: a.sources.length - aiSrc.size,
    aiAnswers: aiSrc.size,
    sourcesNotAnalysed: notAnalysed,
    independentOrigins: a.indep.independentOrigins,
    claims: { total: a.claims.length, verified, unverified, fromAiAnswer },
    sourcedCount: verified,
    uncertainCount: unverified + fromAiAnswer + lowConf,
    aiCount,
    aiItems,
    freshness: fresh,
    conflicts: {
      total: sourceConflicts.length,
      explained,
      unresolved: sourceConflicts.length - explained,
      withAiAnswer,
      byRule: a.conflicts.filter((c) => c.detectedBy === "rule").length,
    },
    gaps,
    thinTopics: thin,
    expectedTopics: a.subQuestions.length,
    openQuestions: a.openQuestions.length,
    coverage: a.subQuestions.length ? (a.subQuestions.length - gaps) / a.subQuestions.length : 0,
    warnings: warnings.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)),
    ingredients,
  };
}
