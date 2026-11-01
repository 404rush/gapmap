// A tiny offline stand-in for the Gemini and Tavily APIs, for trying the live
// mode end to end without keys or network:
//
//   node scripts/mock-ai.mjs            # listens on http://localhost:3999
//   GEMINI_API_KEY=mock GEMINI_API_BASE=http://localhost:3999/v1beta \
//   TAVILY_API_KEY=mock TAVILY_API_BASE=http://localhost:3999 npm run dev
//
// Its "AI" is naive on purpose (it quotes the first sentences of each source);
// it exists to exercise the pipeline, the quote checks and the UI, not to be right.
import http from "node:http";

const PORT = Number(process.env.PORT || 3999);

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const gemini = (obj) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(obj) }] } }] });

function plan(prompt) {
  const q = (prompt.match(/"""([\s\S]*?)"""/) || [])[1] || "the question";
  const topic = q.replace(/\?$/, "").slice(0, 60);
  return {
    subQuestions: [
      { text: "Who does this apply to?", importance: "critical", volatility: "medium", why: `Decides whether "${topic}" is relevant to you.` },
      { text: "What are the current rules or limits?", importance: "critical", volatility: "fast", why: "The core of the answer." },
      { text: "What documents or steps are needed?", importance: "important", volatility: "medium", why: "Missing a step causes delays." },
      { text: "Are there deadlines or recent changes?", importance: "critical", volatility: "fast", why: "Old rules may no longer apply." },
      { text: "Where can it be confirmed officially?", importance: "optional", volatility: "slow", why: "So you can check it yourself." },
    ],
  };
}

function extract(prompt) {
  const ids = [...prompt.matchAll(/^(q\d+): /gm)].map((m) => m[1]);
  const text = (prompt.match(/--- SOURCE TEXT START[^\n]*\n([\s\S]*?)\n--- SOURCE TEXT END ---/) || [])[1] || "";
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6 && !/\[\.\.\.\]/.test(s))
    .slice(0, 6);
  const claims = sentences.map((s, i) => ({
    subQuestionId: ids[(i + 1) % Math.max(1, ids.length)] || "q1",
    claim: s.length > 120 ? `${s.slice(0, 117)}...` : s,
    quote: s.split(/\s+/).slice(0, 30).join(" "),
    timeReference: (s.match(/\b(19|20)\d{2}\b/) || [""])[0],
  }));
  // One deliberately invented quote, to show the verbatim check at work.
  if (claims.length) claims.push({ subQuestionId: claims[0].subQuestionId, claim: "An invented detail.", quote: "this sentence does not appear anywhere in the source", timeReference: "" });
  return { claims, raisedQuestions: sentences.length ? ["Does this still apply this year?"] : [] };
}

function analyze(prompt) {
  const ids = [...prompt.matchAll(/^(q\d+) \[/gm)].map((m) => m[1]);
  const claims = [...prompt.matchAll(/^(s\d+c\d+) \[(q\d+), (s\d+)/gm)].map((m) => ({ id: m[1], q: m[2], s: m[3] }));
  const summaries = ids
    .map((q) => {
      const cs = claims.filter((c) => c.q === q).slice(0, 3);
      return cs.length ? { subQuestionId: q, summary: `The sources describe this ${cs.map((c) => `[${c.id}]`).join(" ")}.` } : null;
    })
    .filter(Boolean);
  const empty = ids.filter((q) => !claims.some((c) => c.q === q));
  return {
    summaries,
    conflicts: [],
    outdated: [],
    openQuestions: empty.slice(0, 2).map((q) => ({ question: `None of the sources answer topic ${q.slice(1)}.`, raisedBySourceIds: [], subQuestionId: q })),
    checklist: [
      ...empty.map((q) => ({
        priority: "critical",
        task: `Find an official source for topic ${q.slice(1)}.`,
        whereToVerify: "The responsible organisation's official website",
        searchQuery: `official ${q}`,
        why: "No reviewed source covers it.",
        askSource: "Could you confirm the current rule on this point, and where it is published?",
        relatedIds: [q],
        origin: "gap",
      })),
      { priority: "optional", task: "Check the date on each source before relying on it.", whereToVerify: "Each page's update line", searchQuery: "", why: "Rules change.", relatedIds: [], origin: "general" },
    ],
  };
}

function search(query) {
  const page = (n, host, type, days) => {
    const d = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return {
      title: `${type} page ${n} about ${query.slice(0, 40)}`,
      url: `https://${host}/mock/${n}`,
      content: `A short snippet from ${type.toLowerCase()} page ${n}.`,
      raw_content: `${type} page ${n}\nLast updated: ${d}\nThis page explains the current rules for people asking about ${query}. Applicants must provide an identity document and proof of address before the deadline. The limit was revised this year and older pages may show the previous figure. Contact the help desk to confirm any detail before you act.`,
      published_date: d,
    };
  };
  return { results: [page(1, "transport.gov.in", "Official", 20), page(2, "www.thehindu.com", "News", 400), page(3, "www.reddit.com/r/india", "Forum", 60)] };
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        if (req.method === "GET" && req.url.startsWith("/v1beta/models")) return json(res, 200, { models: [{ name: "models/mock-flash", supportedGenerationMethods: ["generateContent"] }] });
        const body = raw ? JSON.parse(raw) : {};
        if (req.url.includes(":generateContent")) {
          const props = Object.keys(body.generationConfig?.responseSchema?.properties ?? {});
          const prompt = body.contents?.[0]?.parts?.[0]?.text ?? "";
          const out = props.includes("subQuestions") || prompt.includes("sub-questions a complete")
            ? plan(prompt)
            : props.includes("claims") || prompt.includes("SOURCE TEXT START")
              ? extract(prompt)
              : analyze(prompt);
          return setTimeout(() => json(res, 200, gemini(out)), 400);
        }
        if (req.url.startsWith("/search")) return json(res, 200, search(body.query || ""));
        json(res, 404, { error: "not found" });
      } catch (e) {
        json(res, 500, { error: String(e) });
      }
    });
  })
  .listen(PORT, () => console.log(`mock AI + search on http://localhost:${PORT}`));
