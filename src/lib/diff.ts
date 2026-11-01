// Compare two runs of the same coverage plan: which topics changed status,
// which sources were added, and which checklist items are still open.

import type { Analysis, ChecklistItem, NodeStatus, StatusChange } from "./types";

/** Higher = less settled. */
export const SEVERITY: Record<NodeStatus, number> = { covered: 0, thin: 1, outdated: 2, contested: 3, gap: 4 };

export function samePlan(a: Analysis, b: Analysis): boolean {
  const key = (x: Analysis) => x.subQuestions.map((q) => `${q.id}:${q.text.trim().toLowerCase()}`).join("|");
  return a.question.trim() === b.question.trim() && key(a) === key(b);
}

export function diffAnalyses(prev: Analysis, next: Analysis): StatusChange[] {
  if (!samePlan(prev, next)) return [];
  const prevSources = new Set(prev.sources.map((s) => `${s.id}|${s.title}`));
  const changes: StatusChange[] = [];
  for (const r of next.results) {
    const before = prev.results.find((x) => x.subQuestionId === r.subQuestionId);
    if (!before || before.status === r.status) continue;
    const supporting = new Set(next.claims.filter((c) => c.subQuestionId === r.subQuestionId && c.verified).map((c) => c.sourceId));
    const added = next.sources.filter((s) => supporting.has(s.id) && !prevSources.has(`${s.id}|${s.title}`)).map((s) => s.id);
    changes.push({ subQuestionId: r.subQuestionId, from: before.status, to: r.status, addedSourceIds: added });
  }
  return changes;
}

/** Tag checklist items: "still-open" when every topic is unchanged and unsettled; "new" when a topic got worse. */
export function tagChecklist(prev: Analysis, next: Analysis): ChecklistItem[] {
  if (!samePlan(prev, next)) return next.checklist;
  const before = new Map(prev.results.map((r) => [r.subQuestionId, r.status]));
  const now = new Map(next.results.map((r) => [r.subQuestionId, r.status]));
  return next.checklist.map((item) => {
    if (!item.topicIds.length) return item;
    const worse = item.topicIds.some((t) => before.has(t) && SEVERITY[now.get(t)!] > SEVERITY[before.get(t)!]);
    if (worse) return { ...item, tag: "new" as const };
    const unchanged = item.topicIds.every((t) => before.get(t) === now.get(t) && now.get(t) !== "covered");
    return unchanged ? { ...item, tag: "still-open" as const } : item;
  });
}

export function withComparison(prev: Analysis | null, next: Analysis): Analysis {
  if (!prev || !samePlan(prev, next)) return next;
  return { ...next, changes: diffAnalyses(prev, next), checklist: tagChecklist(prev, next) };
}
