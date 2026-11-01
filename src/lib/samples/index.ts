// Sample mode: clearly identified, fictional sources plus saved AI outputs,
// so the full workflow can be demonstrated without API keys. The
// deterministic layer runs for real on every sample run.

import { assembleAnalysis } from "../assemble";
import { findCycleMentions, findDateInText } from "../dates";
import { verifyQuote } from "../quotes";
import type { Analysis, Claim, Source } from "../types";
import { AMBARPUR } from "./ambarpur";
import { RIVERTON } from "./riverton";
import type { RawSource, SampleScenario } from "./types";

export type { SampleScenario } from "./types";

export const SCENARIOS: SampleScenario[] = [AMBARPUR, RIVERTON];

export const SAMPLE_NOTICE =
  "Sample sources are fictional and written for this demo. The places and organisations named are invented; no real organisation is represented.";

export function getScenario(id: string | undefined): SampleScenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export function toSampleSource(r: RawSource, now: Date): Source {
  const d = r.type === "ai-answer" ? undefined : findDateInText(r.text, now);
  return {
    id: r.id,
    kind: "sample",
    url: r.url,
    title: r.title,
    site: r.site,
    sourceType: r.type,
    publishedDate: d?.date,
    dateLabel: d?.label,
    dateEvidence: d?.evidence,
    dateConfidence: d ? "inferred" : "none",
    cycleMentions: findCycleMentions(r.text),
    text: r.text,
    fetchedAt: now.toISOString(),
    via: "sample",
    isSample: true,
    note: r.type === "ai-answer" ? "Pasted AI answer — checked like any other source, never treated as evidence on its own." : undefined,
  };
}

export function sampleSources(scenario: SampleScenario, now = new Date()): Source[] {
  return scenario.raw.map((r) => toSampleSource(r, now));
}

export function extraSampleSource(scenario: SampleScenario, now = new Date()): Source | undefined {
  return scenario.extra ? toSampleSource(scenario.extra.source, now) : undefined;
}

/** Run the full pipeline on the sample sources currently in the list (no network). */
export function runSample(scenario: SampleScenario, sources: Source[], now = new Date()): Analysis {
  const ids = new Set(sources.map((s) => s.id));
  const hasExtra = !!scenario.extra && ids.has(scenario.extra.source.id);
  const textById = new Map(sources.map((s) => [s.id, s.text]));
  const rawClaims = [...scenario.claims, ...(hasExtra ? scenario.extra!.claims : [])].filter((c) => ids.has(c.sourceId));
  const claims: Claim[] = rawClaims.map((c) => {
    const m = verifyQuote(textById.get(c.sourceId) ?? "", c.quote);
    return { ...c, verified: m.verified, matchKind: m.kind, matchStart: m.start, matchEnd: m.end };
  });
  const ai = hasExtra ? scenario.extra!.patch(scenario.ai) : structuredClone(scenario.ai);
  return assembleAnalysis({
    question: scenario.question,
    subQuestions: scenario.subQuestions,
    sources,
    claims,
    ai,
    raisedQuestions: scenario.raised.filter((r) => ids.has(r.sourceId)),
    now,
    mode: "sample",
    scenario: scenario.id,
    model: "Saved sample outputs",
  });
}
