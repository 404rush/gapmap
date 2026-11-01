import { describe, expect, it } from "vitest";
import { assembleAnalysis } from "@/lib/assemble";
import { normalizeAiFindings } from "@/lib/validate";

describe("normalizeAiFindings", () => {
  it("keeps valid items, drops broken ones and maps synonyms", () => {
    const f = normalizeAiFindings({
      summaries: [{ subQuestionId: "q1", summary: "ok" }, { nope: true }],
      conflicts: "not a list",
      checklist: [{ priority: "high", task: "Check it", whereToVerify: "Portal", searchQuery: "q", why: "w", relatedIds: [], origin: "gap" }],
    });
    expect(f.summaries).toHaveLength(1);
    expect(f.conflicts).toEqual([]);
    expect(f.checklist[0].priority).toBe("critical");
  });
  it("treats a garbage reply as empty findings", () => {
    expect(normalizeAiFindings("<html>error</html>")).toMatchObject({ summaries: [], conflicts: [], checklist: [] });
  });
});

describe("assembleAnalysis with an unhelpful AI", () => {
  it("still computes statuses and rule-based checklist items", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const src = (id: string, text: string, date?: string) => ({
      id, kind: "text" as const, title: id, site: "x", sourceType: "news" as const, publishedDate: date,
      dateConfidence: date ? ("found" as const) : ("none" as const), cycleMentions: [], text, fetchedAt: now.toISOString(),
    });
    const a = assembleAnalysis({
      question: "Q?",
      subQuestions: [
        { id: "q1", text: "Fee?", importance: "critical", volatility: "fast", why: "" },
        { id: "q2", text: "Deadline?", importance: "critical", volatility: "fast", why: "" },
      ],
      sources: [src("s1", "The fee is 40% of the fare.", "2026-10-01"), src("s2", "The fee is 50% of the fare today.", "2026-10-02")],
      claims: [
        { id: "s1c1", sourceId: "s1", subQuestionId: "q1", claim: "Fee is 40%", quote: "The fee is 40% of the fare.", verified: true },
        { id: "s2c1", sourceId: "s2", subQuestionId: "q1", claim: "Fee is 50%", quote: "The fee is 50% of the fare today.", verified: true },
      ],
      ai: null,
      now,
      mode: "live",
    });
    expect(a.results.find((r) => r.subQuestionId === "q2")?.status).toBe("gap");
    expect(a.results.find((r) => r.subQuestionId === "q1")?.status).toBe("contested"); // caught by the number check
    expect(a.conflicts[0].detectedBy).toBe("rule");
    expect(a.checklist.map((c) => c.origin)).toEqual(expect.arrayContaining(["gap", "conflict"]));
  });
});
