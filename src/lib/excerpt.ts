// Long sources: instead of only the first N characters, send the AI the
// opening (title, date, context) plus the paragraphs that best match the
// question and coverage plan, in their original order. Quotes are still
// verified against the full text.

const STOP = new Set(
  "the and for are was were with that this from have has had not but can will what which when where who how why should would could does did about into your their there them they then than also any all its our out you get may must only each per".split(" "),
);

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}

export function selectExcerpts(text: string, queries: string[], limit = 24_000): { text: string; excerpted: boolean } {
  if (text.length <= limit) return { text, excerpted: false };
  const head = text.slice(0, 1500);
  const rest = text.slice(1500);
  const paras = rest.split(/\n+/).map((p, i) => ({ p: p.trim(), i })).filter((x) => x.p.length > 0);
  const q = new Map<string, number>();
  for (const w of tokens(queries.join(" "))) q.set(w, (q.get(w) ?? 0) + 1);
  const scored = paras.map((x) => {
    const words = tokens(x.p);
    let hits = 0;
    for (const w of words) if (q.has(w)) hits++;
    // Favour paragraphs that mention numbers or dates: they carry the checkable details.
    const detail = /\d/.test(x.p) ? 1.2 : 1;
    return { ...x, score: words.length ? (hits / Math.sqrt(words.length)) * detail : 0 };
  });
  const budget = limit - head.length - 200;
  const chosen: typeof scored = [];
  let used = 0;
  for (const x of [...scored].sort((a, b) => b.score - a.score)) {
    if (x.score <= 0) break;
    if (used + x.p.length + 7 > budget) continue;
    chosen.push(x);
    used += x.p.length + 7;
  }
  chosen.sort((a, b) => a.i - b.i);
  const parts: string[] = [head.trim()];
  let last = -2;
  for (const x of chosen) {
    parts.push(x.i === last + 1 ? x.p : `[...]\n${x.p}`);
    last = x.i;
  }
  return { text: parts.join("\n"), excerpted: true };
}
