import { describe, expect, it } from "vitest";
import { selectExcerpts } from "@/lib/excerpt";

describe("selectExcerpts", () => {
  it("keeps short texts whole", () => {
    expect(selectExcerpts("short text", ["anything"])).toEqual({ text: "short text", excerpted: false });
  });
  it("keeps the start and the most relevant paragraphs of a long text", () => {
    const filler = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} talks about unrelated history of the railway and its stations.`).join("\n\n");
    const text = `Intro to the scheme.\n\n${filler}\n\nThe application deadline is 30 November 2026 for all students.\n\n${filler}`;
    const r = selectExcerpts(text, ["What is the application deadline?"], 6000);
    expect(r.excerpted).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(6200);
    expect(r.text).toContain("Intro to the scheme.");
    expect(r.text).toContain("application deadline is 30 November 2026");
  });
});
