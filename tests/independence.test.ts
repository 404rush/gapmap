import { describe, expect, it } from "vitest";
import { independenceGroups } from "@/lib/independence";

const article =
  "The metro will offer a fifty percent concession to students from the new academic session. Students must submit a bonafide certificate issued by their institution along with a photo identity card at any station counter. The pass will be valid for one year and can be renewed online through the official portal before it expires. Officials said the scheme aims to cut travel costs for nearly two lakh students in the district.";

describe("independenceGroups", () => {
  it("groups a page that copies another", () => {
    const blog = `Everything you need to know. ${article} Share this post with your friends.`;
    const r = independenceGroups([
      { id: "s1", text: article },
      { id: "s2", text: blog },
      { id: "s3", text: "A completely different official FAQ about eligibility, documents, fees and validity of the student pass for the coming year." },
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].sourceIds.sort()).toEqual(["s1", "s2"]);
    expect(r.independentOrigins).toBe(2);
  });
  it("does not treat a forum post quoting one sentence as a copy", () => {
    const forum =
      "Has anyone renewed their pass? The article says 'The pass will be valid for one year and can be renewed online through the official portal before it expires.' but when I tried the portal it asked me to visit a counter, and the staff there said renewals were paused until December. Very confusing, would love to hear from anyone who managed it.";
    const r = independenceGroups([
      { id: "s1", text: article },
      { id: "s2", text: forum },
    ]);
    expect(r.groups).toHaveLength(0);
    expect(r.independentOrigins).toBe(2);
  });
});
