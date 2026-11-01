import { describe, expect, it } from "vitest";
import { isPrivateIp, parseRobots, robotsAllowsPath, htmlToSource, textToSource } from "@/lib/server/fetchSource";
import { rateLimit } from "@/lib/server/rateLimit";

describe("isPrivateIp (SSRF guard)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.5.4", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "100.64.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "142.250.183.14", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe("robots.txt", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/faq\n\nUser-agent: OtherBot\nDisallow: /");
  it("applies the most specific rule", () => {
    expect(robotsAllowsPath(rules, "/public")).toBe(true);
    expect(robotsAllowsPath(rules, "/private/data")).toBe(false);
    expect(robotsAllowsPath(rules, "/private/faq")).toBe(true);
  });
});

describe("htmlToSource", () => {
  it("keeps paragraph and list structure and finds the date", () => {
    const html = `<html><head><title>Pass FAQ | Metro</title><meta property="article:modified_time" content="2026-08-12T10:00:00Z"></head>
      <body><nav>Menu</nav><main><article><h1>Student pass</h1><p>Heading here</p><p>First paragraph of the answer with enough words to count as content for the reader.</p>
      <ul><li>ID card</li><li>Photo</li></ul><p>Second paragraph with more words so that readability keeps this article content intact.</p></article></main></body></html>`;
    const s = htmlToSource(html, new URL("https://metro.gov.in/faq"), "s1", new Date("2026-11-01"));
    expect(s.text).not.toContain("Heading hereFirst");
    expect(s.text).toMatch(/• ID card/);
    expect(s.publishedDate).toBe("2026-08-12");
    expect(s.sourceType).toBe("official");
  });
});

describe("textToSource", () => {
  it("never dates an AI answer and rejects a future date", () => {
    expect(textToSource({ id: "s1", title: "", text: "Updated 1 Oct 2026. Some answer text that is long enough.", isAiAnswer: true }).publishedDate).toBeUndefined();
    expect(() => textToSource({ id: "s2", title: "", text: "Some pasted text that is long enough to count.", date: "2099-01-01" })).toThrow();
  });
});

describe("rateLimit", () => {
  it("returns 429 after the per-minute limit", () => {
    const req = new Request("http://x/api/search", { headers: { "x-forwarded-for": "203.0.113.9" } });
    const now = 1_000_000;
    let res: Response | null = null;
    for (let i = 0; i < 16; i++) res = rateLimit(req, "search", now);
    expect(res?.status).toBe(429);
    expect(rateLimit(req, "search", now + 61_000)).toBeNull();
  });
});
