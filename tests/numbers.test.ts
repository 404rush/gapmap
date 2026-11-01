import { describe, expect, it } from "vitest";
import { extractNumbers } from "@/lib/numbers";

describe("extractNumbers", () => {
  it("reads percentages, money and durations", () => {
    const kinds = (t: string) => extractNumbers(t).map((n) => `${n.kind}:${n.value}`);
    expect(kinds("a 40% concession")).toContain("percent:40");
    expect(kinds("costs ₹50 per card")).toContain("money:50");
    expect(kinds("boil for at least 1 minute")).toContain("minutes:1");
    expect(kinds("boil water for 10 minutes")).toContain("minutes:10");
    expect(kinds("valid for 2 years")).toContain("years:2");
  });
});
