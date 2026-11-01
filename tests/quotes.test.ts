import { describe, expect, it } from "vitest";
import { closestPassage, containsQuote, verifyQuote } from "@/lib/quotes";

const PAGE = "Who can apply?\nFull-time students aged 12 to 25, enrolled in a recognised school, can apply. The fee is ₹50.";

describe("verifyQuote", () => {
  it("finds exact quotes and their position", () => {
    const m = verifyQuote(PAGE, "Full-time students aged 12 to 25");
    expect(m.verified).toBe(true);
    expect(m.kind).toBe("exact");
    expect(PAGE.slice(m.start, m.end)).toBe("Full-time students aged 12 to 25");
  });
  it("tolerates whitespace, curly quotes and an ellipsis", () => {
    expect(verifyQuote(PAGE, "Full-time  students aged 12 to 25 … can apply").verified).toBe(true);
  });
  it("accepts a missing comma as a punctuation-only difference", () => {
    const m = verifyQuote(PAGE, "aged 12 to 25 enrolled in a recognised school");
    expect(m).toMatchObject({ verified: true, kind: "ignoring-punctuation" });
  });
  it("rejects words that aren't on the page", () => {
    expect(verifyQuote(PAGE, "students aged 12 to 30 can apply").verified).toBe(false);
  });
});

describe("closestPassage", () => {
  it("points at the most similar passage for a failed quote", () => {
    const p = closestPassage(PAGE, "students aged 12 to 30 enrolled in a recognised school");
    expect(p).toBeDefined();
    expect(PAGE.slice(p!.start, p!.end)).toMatch(/aged 12 to 25/);
  });
  it("returns nothing when no passage is close", () => {
    expect(closestPassage(PAGE, "the moon is made of green cheese entirely")).toBeUndefined();
  });
});

describe("containsQuote", () => {
  it("needs at least six words", () => {
    expect(containsQuote(PAGE, "The fee is")).toBe(false);
    expect(containsQuote(PAGE, "enrolled in a recognised school, can apply")).toBe(true);
  });
});
