// Verbatim quote check: every "sourced" claim must point at text that is
// really on the page. If we can't find it, the claim is downgraded to
// "uncertain" instead of being shown as fact.

export type MatchKind = "exact" | "ignoring-punctuation";

export interface QuoteMatch {
  verified: boolean;
  kind?: MatchKind;
  start?: number;
  end?: number;
}

const SINGLE_QUOTES = /[‘’‚‛′`]/;
const DOUBLE_QUOTES = /[“”„‟″]/;
const DASHES = /[‐-―−]/;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Lowercase, unify quotes/dashes, collapse whitespace. Returns the
 * normalized string plus a map from normalized index -> original index. */
export function normalizeWithMap(input: string): { norm: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < input.length; i++) {
    let ch = input[i];
    if (SINGLE_QUOTES.test(ch)) ch = "'";
    else if (DOUBLE_QUOTES.test(ch)) ch = '"';
    else if (DASHES.test(ch)) ch = "-";
    else if (ch === " ") ch = " ";
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      out.push(" ");
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    out.push(ch.toLowerCase());
    map.push(i);
    lastWasSpace = false;
  }
  return { norm: out.join(""), map };
}

/** Keep only letters and digits (any script), one space between words. */
export function wordsOnlyWithMap(input: string): { norm: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let lastWasSpace = true;
  for (let i = 0; i < input.length; ) {
    const cp = input.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    if (WORD_CHAR.test(ch)) {
      for (const c of ch.toLowerCase()) {
        out.push(c);
        map.push(i);
      }
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      out.push(" ");
      map.push(i);
      lastWasSpace = true;
    }
    i += ch.length;
  }
  return { norm: out.join(""), map };
}

function stripEdges(s: string): string {
  return s.replace(/^[\s"'.…,;:•|*\-]+|[\s"'.…,;:•|*\-]+$/g, "");
}

function endOf(map: number[], idx: number, text: string): number {
  const i = map[idx];
  const cp = text.codePointAt(i);
  return i + (cp !== undefined && cp > 0xffff ? 2 : 1);
}

/**
 * Find `quote` inside `text`. Tries an exact match (case, spacing and quote
 * styles normalised), then an ellipsis-split quote whose parts appear in order,
 * then a match that ignores punctuation only. Words must always match exactly.
 */
export function verifyQuote(text: string, quote: string): QuoteMatch {
  const q = stripEdges(normalizeWithMap(quote).norm.trim());
  if (q.length < 8) return { verified: false };
  const { norm, map } = normalizeWithMap(text);

  const idx = norm.indexOf(q);
  if (idx >= 0) return { verified: true, kind: "exact", start: map[idx], end: endOf(map, idx + q.length - 1, text) };

  const parts = q
    .split(/\.{3}|…/)
    .map((p) => stripEdges(p))
    .filter((p) => p.length >= 8);
  if (parts.length >= 2) {
    let from = 0;
    let first = -1;
    let lastEnd = -1;
    let ok = true;
    for (const p of parts) {
      const j = norm.indexOf(p, from);
      if (j < 0) {
        ok = false;
        break;
      }
      if (first < 0) first = j;
      lastEnd = j + p.length;
      from = lastEnd;
    }
    if (ok) return { verified: true, kind: "exact", start: map[first], end: endOf(map, lastEnd - 1, text) };
  }

  // Punctuation-insensitive pass: a missing comma or a changed dash shouldn't fail an otherwise word-for-word quote.
  const qw = wordsOnlyWithMap(quote).norm.trim();
  if (qw.split(" ").length >= 3) {
    const tw = wordsOnlyWithMap(text);
    const j = tw.norm.indexOf(qw);
    if (j >= 0) return { verified: true, kind: "ignoring-punctuation", start: tw.map[j], end: endOf(tw.map, j + qw.length - 1, text) };
  }
  return { verified: false };
}

export interface Passage {
  start: number;
  end: number;
  score: number;
}

/**
 * For a quote that failed verification: the window of the page whose words
 * best overlap the quote's words. Shown as "closest passage", never as proof.
 */
export function closestPassage(text: string, quote: string): Passage | undefined {
  const qWords = (quote.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1);
  if (qWords.length < 3) return undefined;
  const qSet = new Set(qWords);
  const words: { w: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) words.push({ w: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length });
  const n = Math.min(Math.max(qWords.length, 4), 60);
  if (words.length < n) return undefined;
  let best: Passage | undefined;
  for (let i = 0; i + n <= words.length; i++) {
    const seen = new Set<string>();
    for (let k = i; k < i + n; k++) if (qSet.has(words[k].w)) seen.add(words[k].w);
    const score = seen.size / qSet.size;
    if (!best || score > best.score) best = { start: words[i].start, end: words[i + n - 1].end, score };
  }
  return best && best.score >= 0.5 ? best : undefined;
}

/** True when `quote` (normalised) appears in `text`. Used to spot one source repeating another. */
export function containsQuote(text: string, quote: string): boolean {
  const q = wordsOnlyWithMap(quote).norm.trim();
  if (q.split(" ").length < 6) return false;
  return wordsOnlyWithMap(text).norm.includes(q);
}
