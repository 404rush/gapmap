// Rule-based number check: a second, deterministic opinion on conflicts.
// For verified claims on the same topic from independent sources, compare the
// numbers their quotes contain (percentages, amounts, durations). Different
// numbers for the same kind of quantity, about the same thing, become one
// possible conflict even if the AI didn't flag it.

import { formatDate, monthsBetween } from "./dates";
import type { Claim, Conflict, Source } from "./types";

export type NumKind = "percent" | "money" | "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "lakh" | "crore";

export interface NumFact {
  kind: NumKind;
  value: number;
  raw: string;
}

const toNum = (s: string) => Number(s.replace(/,/g, ""));

export function extractNumbers(text: string): NumFact[] {
  const out: NumFact[] = [];
  const push = (kind: NumKind, v: string, raw: string) => {
    const value = toNum(v);
    if (Number.isFinite(value)) out.push({ kind, value, raw: raw.trim() });
  };
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s?(?:%|per\s?cent\b)/gi)) push("percent", m[1], m[0]);
  for (const m of text.matchAll(/(?:₹|rs\.?|inr|\$|usd)\s?(\d[\d,]*(?:\.\d+)?)/gi)) push("money", m[1], m[0]);
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s?(?:rupees|rs\b)/gi)) push("money", m[1], m[0]);
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s?(lakhs?|crores?)\b/gi)) push(m[2].toLowerCase().startsWith("l") ? "lakh" : "crore", m[1], m[0]);
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s?(years?|months?|weeks?|days?|hours?|hrs?|minutes?|mins?)\b/gi)) {
    const u = m[2].toLowerCase();
    const kind: NumKind = u.startsWith("y")
      ? "years"
      : u.startsWith("mo")
        ? "months"
        : u.startsWith("w")
          ? "weeks"
          : u.startsWith("d")
            ? "days"
            : u.startsWith("h")
              ? "hours"
              : "minutes";
    push(kind, m[1], m[0]);
  }
  return out;
}

const STOP = new Set(
  "a an the of to in on for and or is are was be been will with by at from as this that it its their they you your can may must only per each every all any not no than then so if into up out over under about after before also more most such these those there here which who whom what when where how get gets got least should".split(
    " ",
  ),
);
const UNITS = new Set(["year", "month", "week", "day", "hour", "minute", "lakh", "crore", "rupee", "percent", "cent"]);

function contentWords(text: string): Set<string> {
  const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
  return new Set(words.map((w) => w.replace(/(ies|es|s)$/, "")).filter((w) => !UNITS.has(w)));
}

function sharesSubject(a: Claim, b: Claim): boolean {
  const wa = contentWords(`${a.claim} ${a.quote}`);
  const wb = contentWords(`${b.claim} ${b.quote}`);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

interface Ctx {
  claims: Claim[];
  sources: Map<string, Source>;
  existing: Conflict[];
  originOf: (sourceId: string) => string;
}

const tag = (s: Source) => `S${s.id.replace(/\D/g, "")}`;
const joinTags = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Possible conflicts found by comparing numbers. Never duplicates a conflict that already covers the same claims. */
export function numericConflicts({ claims, sources, existing, originOf }: Ctx): Omit<Conflict, "id">[] {
  const out: Omit<Conflict, "id">[] = [];
  const facts = new Map(claims.map((c) => [c.id, extractNumbers(c.quote)]));
  const valuesOf = (c: Claim, kind: NumKind) => [...new Set(facts.get(c.id)!.filter((f) => f.kind === kind).map((f) => f.value))].sort((x, y) => x - y);
  const rawOf = (c: Claim, kind: NumKind) => facts.get(c.id)!.find((f) => f.kind === kind)!.raw;
  const disjoint = (a: number[], b: number[]) => a.length > 0 && b.length > 0 && !a.some((v) => b.includes(v));
  const coveredPair = (a: Claim, b: Claim) => [...existing, ...out].some((c) => c.claimIds.includes(a.id) && c.claimIds.includes(b.id));
  const isAi = (c: Claim) => sources.get(c.sourceId)?.sourceType === "ai-answer";

  const byTopic = new Map<string, Claim[]>();
  for (const c of claims) if (c.verified && facts.get(c.id)!.length) byTopic.set(c.subQuestionId, [...(byTopic.get(c.subQuestionId) ?? []), c]);

  for (const [topic, list] of byTopic) {
    const evidence = list.filter((c) => !isAi(c));
    const kinds = new Set(evidence.flatMap((c) => facts.get(c.id)!.map((f) => f.kind)));

    // 1. Between independent sources: one conflict per group of disagreeing claims.
    for (const kind of kinds) {
      const withKind = evidence.filter((c) => valuesOf(c, kind).length);
      const parent = new Map(withKind.map((c) => [c.id, c.id]));
      const find = (k: string): string => (parent.get(k) === k ? k : find(parent.get(k)!));
      let any = false;
      for (let i = 0; i < withKind.length; i++)
        for (let j = i + 1; j < withKind.length; j++) {
          const a = withKind[i];
          const b = withKind[j];
          if (originOf(a.sourceId) === originOf(b.sourceId) || coveredPair(a, b) || !sharesSubject(a, b)) continue;
          if (!disjoint(valuesOf(a, kind), valuesOf(b, kind))) continue;
          parent.set(find(a.id), find(b.id));
          any = true;
        }
      if (!any) continue;
      const comps = new Map<string, Claim[]>();
      for (const c of withKind) comps.set(find(c.id), [...(comps.get(find(c.id)) ?? []), c]);
      for (const comp of comps.values()) {
        if (comp.length < 2) continue;
        const groups = new Map<string, Claim[]>();
        for (const c of comp) groups.set(valuesOf(c, kind).join("/"), [...(groups.get(valuesOf(c, kind).join("/")) ?? []), c]);
        if (groups.size < 2) continue;
        const parts = [...groups.values()].map((g) => {
          const tags = [...new Set(g.map((c) => tag(sources.get(c.sourceId)!)))];
          return `${joinTags(tags)} give${tags.length > 1 ? "" : "s"} ${rawOf(g[0], kind)}`;
        });
        // Explained by dates only when every group is dated and the groups don't overlap in time by 3+ months.
        const spans = [...groups.values()].map((g) => g.map((c) => sources.get(c.sourceId)!.publishedDate));
        let likelyReason: Conflict["likelyReason"] = "unclear";
        let explanation = "The sources give different figures for what looks like the same thing; the reason isn't clear from the text.";
        if (spans.every((s) => s.every(Boolean))) {
          const ranges = spans.map((s) => [s.reduce((x, y) => (x! < y! ? x : y))!, s.reduce((x, y) => (x! > y! ? x : y))!]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
          const gapOk = ranges.every((r, i) => i === 0 || monthsBetween(ranges[i - 1][1], new Date(r[0] + "T00:00:00Z")) >= 3);
          if (gapOk) {
            likelyReason = "different-time";
            explanation = `The figures come from sources dated ${ranges.map((r) => formatDate(r[1])).join(" and ")}; it may have changed in between.`;
          }
        } else if (spans.some((s) => s.some((d) => !d))) {
          explanation = "Some of these sources are undated, so it can't be told whether one figure is simply older.";
        }
        out.push({
          subQuestionId: topic,
          claimIds: comp.map((c) => c.id),
          summary: `${parts.join("; ")}.`,
          likelyReason,
          explanation,
          howToResolve: "Check the latest official source for the current figure.",
          confidence: "medium",
          detectedBy: "rule",
        });
      }
    }

    // 2. A pasted AI answer against the sources, unless the AI already flagged that claim.
    for (const a of list.filter(isAi)) {
      if ([...existing, ...out].some((c) => c.subQuestionId === topic && c.claimIds.includes(a.id))) continue;
      for (const f of facts.get(a.id)!) {
        const against = evidence.filter((b) => valuesOf(b, f.kind).length && disjoint(valuesOf(a, f.kind), valuesOf(b, f.kind)) && sharesSubject(a, b));
        if (!against.length) continue;
        const b = against.sort((x, y) => ((sources.get(y.sourceId)!.publishedDate ?? "") > (sources.get(x.sourceId)!.publishedDate ?? "") ? 1 : -1))[0];
        out.push({
          subQuestionId: topic,
          claimIds: [a.id, b.id],
          summary: `The pasted AI answer gives ${f.raw}; ${tag(sources.get(b.sourceId)!)} gives ${rawOf(b, f.kind)}.`,
          likelyReason: "unclear",
          explanation: "Chatbot answers carry no date or source, so it can't be told whether this figure is older information or a mistake.",
          howToResolve: "Rely on the dated sources, and confirm the figure with the official source.",
          confidence: "medium",
          detectedBy: "rule",
        });
        break;
      }
    }
  }
  return out;
}
