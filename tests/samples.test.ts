// The two sample scenarios run the real deterministic engine. These tests pin
// the findings a judge will see, so a change to the rules can't silently
// break the demo.
import { describe, expect, it } from "vitest";
import { withComparison } from "@/lib/diff";
import { buildReport } from "@/lib/report";
import { checkKey } from "@/lib/checks";
import { extraSampleSource, getScenario, runSample, sampleSources } from "@/lib/samples";
import type { Analysis } from "@/lib/types";

const NOW = new Date("2026-11-01T12:00:00Z");
const statuses = (a: Analysis) => Object.fromEntries(a.results.map((r) => [r.subQuestionId, r.status]));

function run(id: string, withExtra = false) {
  const sc = getScenario(id);
  const sources = sampleSources(sc, NOW);
  if (withExtra) sources.push(extraSampleSource(sc, NOW)!);
  return runSample(sc, sources, NOW);
}

describe("Ambarpur scenario", () => {
  const a = run("ambarpur");
  it("gives the expected statuses", () => {
    expect(statuses(a)).toEqual({ q1: "covered", q2: "outdated", q3: "contested", q4: "covered", q5: "gap", q6: "contested", q7: "thin" });
  });
  it("detects the copied blog and counts it as one origin", () => {
    expect(a.independence.map((g) => [...g.sourceIds].sort())).toEqual([["s2", "s3"]]);
    expect(a.label.independentOrigins).toBe(4);
  });
  it("never counts the AI answer as a source or as evidence", () => {
    expect(a.label.sourcesReviewed).toBe(5);
    expect(a.label.aiAnswers).toBe(1);
    expect(a.label.claims.verified).toBe(a.claims.filter((c) => c.verified && c.sourceId !== "s6").length);
    expect(a.label.conflicts.withAiAnswer).toBeGreaterThan(0);
  });
  it("marks the fabricated quote as unverified", () => {
    expect(a.label.claims.unverified).toBe(1);
  });
  it("has a checklist step for every gap and conflict", () => {
    for (const r of a.results.filter((x) => x.status === "gap" || x.status === "contested"))
      expect(a.checklist.some((c) => c.topicIds.includes(r.subQuestionId)), r.subQuestionId).toBe(true);
  });
  it("prefers the official source as the newest", () => {
    const q3 = a.results.find((r) => r.subQuestionId === "q3")!;
    expect(a.claims.find((c) => c.id === q3.newestClaimId)?.sourceId).toBe("s1");
  });
  it("closes the loop: adding the newer notice fills the deadline gap", () => {
    const after = withComparison(a, run("ambarpur", true));
    expect(statuses(after).q5).toBe("thin");
    expect(after.changes).toEqual([{ subQuestionId: "q5", from: "gap", to: "thin", addedSourceIds: ["s7"] }]);
    expect(after.checklist.some((c) => c.tag === "still-open")).toBe(true);
  });
});

describe("Riverton scenario", () => {
  const a = run("riverton");
  it("gives the expected statuses", () => {
    expect(statuses(a)).toEqual({ q1: "contested", q2: "outdated", q3: "contested", q4: "covered", q5: "gap", q6: "covered", q7: "thin" });
  });
  it("catches the boiling-time conflict the saved AI output missed", () => {
    const rule = a.conflicts.filter((c) => c.detectedBy === "rule" && c.subQuestionId === "q3");
    expect(rule.length).toBeGreaterThan(0);
    expect(rule.some((c) => /1 minute/.test(c.summary) && /10 minutes/.test(c.summary))).toBe(true);
  });
  it("closes the loop with the test report", () => {
    expect(statuses(withComparison(a, run("riverton", true))).q5).toBe("thin");
  });
});

describe("report", () => {
  it("includes ticks, notes and every source", () => {
    const a = run("ambarpur");
    const item = a.checklist[0];
    const md = buildReport(a, { [checkKey(item)]: { done: true, note: "Called the helpline" } });
    expect(md).toContain("- [x]");
    expect(md).toContain("Your note: Called the helpline");
    for (const s of a.sources) expect(md).toContain(`**S${s.id.slice(1)}**`);
    expect(md).toContain("AI answer vs sources");
    expect(md).not.toMatch(/\[s\d+c\d+/); // citations are turned into source tags
  });
});
