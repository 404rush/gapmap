import { describe, expect, it } from "vitest";
import { classifySource } from "@/lib/sourceType";

describe("classifySource", () => {
  it.each([
    ["https://passportindia.gov.in/AppOnlineProject/online/faqDocument", "official"],
    ["https://uidai.gov.in/en/", "official"],
    ["https://www.nta.ac.in/notice", "official"],
    ["https://www.iitb.ac.in/admissions", "academic"],
    ["https://www.thehindu.com/news/cities/article1.ece", "news"],
    ["https://www.reddit.com/r/india/comments/abc", "forum"],
    ["https://en.wikipedia.org/wiki/Passport", "reference"],
    ["https://www.shiksha.com/exams/neet", "aggregator"],
    ["https://someone.medium.com/my-trip", "blog"],
    ["https://example.com/page", "other"],
    ["not a url", "other"],
  ])("%s → %s", (url, type) => {
    expect(classifySource(url)).toBe(type);
  });
  it("doesn't trust a page title that claims to be official", () => {
    // Classification is by address only: a coaching site can't become "official" by its title.
    expect(classifySource("https://www.careers360.com/official-notice-2026")).toBe("aggregator");
  });
});
