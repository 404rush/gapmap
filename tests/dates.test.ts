import { describe, expect, it } from "vitest";
import { cycleEnded, findCycleMentions, findDateInText, isPlausiblePublishDate, parseLooseDate } from "@/lib/dates";

const NOW = new Date("2026-11-01T12:00:00Z");

describe("parseLooseDate", () => {
  it("reads common spellings", () => {
    expect(parseLooseDate("12 Aug 2026")).toBe("2026-08-12");
    expect(parseLooseDate("August 12, 2026")).toBe("2026-08-12");
    expect(parseLooseDate("2026-08-12")).toBe("2026-08-12");
    expect(parseLooseDate("12/08/2026")).toBe("2026-08-12"); // day first
    expect(parseLooseDate("08/25/2026")).toBe("2026-08-25"); // only month-first makes sense
  });
  it("rejects impossible dates", () => {
    expect(parseLooseDate("31 February 2026")).toBeUndefined();
    expect(parseLooseDate("2026-13-01")).toBeUndefined();
  });
});

describe("findDateInText", () => {
  it("finds an update date and labels it", () => {
    const d = findDateInText("Student pass FAQ\nLast updated: 12 August 2026\nWho can apply?", NOW);
    expect(d).toMatchObject({ date: "2026-08-12", label: "Last updated" });
  });
  it("ignores deadlines and event dates", () => {
    expect(findDateInText("Notice\nLast date: 30 November 2026\nApply online.", NOW)).toBeUndefined();
    expect(findDateInText("Exam date: 12 March 2026", NOW)).toBeUndefined();
  });
  it("does not read 'mandate' as 'date'", () => {
    expect(findDateInText("The mandate 12 March 2025 was revised.", NOW)).toBeUndefined();
  });
  it("rejects future dates", () => {
    expect(findDateInText("Published: 3 March 2027", NOW)).toBeUndefined();
    expect(isPlausiblePublishDate("2027-01-01", NOW)).toBe(false);
  });
  it("prefers 'updated' over 'published'", () => {
    const d = findDateInText("Published: 3 March 2024. Updated on 5 June 2026.", NOW);
    expect(d?.date).toBe("2026-06-05");
  });
});

describe("cycles", () => {
  it("finds academic cycles and knows when they ended", () => {
    expect(findCycleMentions("Valid for the 2024-25 session")).toContain("2024-25");
    expect(cycleEnded("2024-25", NOW)).toBe(true);
    expect(cycleEnded("2026-27", NOW)).toBe(false);
  });
});
