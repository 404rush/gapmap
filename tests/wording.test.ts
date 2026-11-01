import { afterEach, describe, expect, it, vi } from "vitest";
import { keywords, searchFor } from "@/lib/assemble";
import { postJson } from "@/lib/client/api";
import { fixSourceIds, normalizeAiFindings } from "@/lib/validate";

describe("AI wording clean-up", () => {
  it("writes source ids the way the app shows them", () => {
    expect(fixSourceIds("s5 is older than s2, see s2c1")).toBe("S5 is older than S2, see S2c1");
    expect(fixSourceIds("rules S3 and words like sss1 stay as they are")).toBe("rules S3 and words like sss1 stay as they are");
    const ai = normalizeAiFindings({
      conflicts: [{ summary: "s1 says 18%", claimIds: [], explanation: "s5 dates from 2017", howToResolve: "" }],
    });
    expect(ai.conflicts[0].summary).toBe("S1 says 18%");
    expect(ai.conflicts[0].explanation).toBe("S5 dates from 2017");
  });

  it("builds a short keyword search for rule-made checklist items", () => {
    const q = keywords("What GST rate applies to packaged snacks now?").slice(0, 4);
    expect(searchFor(q, "Have recent GST council revisions changed the rates for snack foods?")).toBe(
      "GST rate packaged snacks recent council revisions changed foods",
    );
    expect(keywords("Is income up to ₹12 lakh tax-free?")).toEqual(["income", "₹12", "lakh", "tax-free"]);
  });
});

describe("browser API calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries once when the connection drops, then succeeds", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(postJson("/api/x", {})).resolves.toEqual({ ok: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry GapMap's own errors", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "The AI service is busy." }), { status: 503, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(postJson("/api/x", {})).rejects.toThrow("The AI service is busy.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
