// Source independence check: detect when several "sources" are really
// copies of one original (copied or lightly reworded text). Uses word
// 5-gram shingles and overlap ratios. Deterministic, no AI.

import type { IndependenceGroup } from "./types";

function shingles(text: string, n = 5): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/** Two texts count as copies only when they share a substantial amount of wording
 * relative to BOTH texts, so a forum post quoting one sentence of an official
 * page is not treated as a copy of it. */
export const MIN_SHARED = 20;
export const MIN_SMALL_RATIO = 0.3;
export const MIN_LARGE_RATIO = 0.1;

export function copySimilarity(a: Set<string>, b: Set<string>): { shared: number; small: number; large: number } {
  if (!a.size || !b.size) return { shared: 0, small: 0, large: 0 };
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const s of small) if (big.has(s)) shared++;
  return { shared, small: shared / small.size, large: shared / big.size };
}

export function isCopy(sim: { shared: number; small: number; large: number }): boolean {
  return sim.shared >= MIN_SHARED && sim.small >= MIN_SMALL_RATIO && sim.large >= MIN_LARGE_RATIO;
}

export function independenceGroups(sources: { id: string; text: string }[]): {
  groups: IndependenceGroup[];
  independentOrigins: number;
  originOf: Record<string, number>;
} {
  const sh = sources.map((s) => shingles(s.text));
  const parent = sources.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairSim: Record<string, number> = {};
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const sim = copySimilarity(sh[i], sh[j]);
      if (isCopy(sim)) {
        parent[find(i)] = find(j);
        pairSim[`${i}:${j}`] = sim.small;
      }
    }
  }
  const byRoot = new Map<number, number[]>();
  sources.forEach((_, i) => {
    const r = find(i);
    byRoot.set(r, [...(byRoot.get(r) ?? []), i]);
  });
  const originOf: Record<string, number> = {};
  const groups: IndependenceGroup[] = [];
  let k = 0;
  for (const members of byRoot.values()) {
    members.forEach((i) => (originOf[sources[i].id] = k));
    k++;
    if (members.length > 1) {
      let best = 0;
      for (let a = 0; a < members.length; a++)
        for (let b = a + 1; b < members.length; b++) {
          const key = `${Math.min(members[a], members[b])}:${Math.max(members[a], members[b])}`;
          best = Math.max(best, pairSim[key] ?? 0);
        }
      groups.push({ sourceIds: members.map((i) => sources[i].id), similarity: Math.round(best * 100) / 100 });
    }
  }
  return { groups, independentOrigins: byRoot.size, originOf };
}
