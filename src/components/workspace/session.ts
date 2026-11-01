// The working session: everything needed to pick up where the user left off,
// saved in the browser (IndexedDB). Nothing here is sent anywhere.

import type { Checks } from "@/lib/checks";
import { getItem, removeItem, setItem } from "@/lib/client/store";
import { hash } from "@/lib/hash";
import type { Analysis, Claim, NodeStatus, Source, SubQuestion } from "@/lib/types";

export type Mode = "live" | "sample";
export type Step = 1 | 2 | 3 | 4;
export type ItemOrigin = "link" | "search" | "paste" | "pdf" | "ai" | "sample";

/** Enough to try adding a link again. */
export interface RetryInfo {
  url: string;
  fallbackText?: string;
  fallbackTitle?: string;
  fallbackDate?: string;
}

export interface StoredItem {
  id: string;
  status: "loading" | "ready" | "error";
  label: string;
  origin: ItemOrigin;
  source?: Source;
  error?: string;
  retry?: RetryInfo;
}

export interface ExtractResult {
  claims: Claim[];
  raised: string[];
  excerpted: boolean;
}

export interface SessionData {
  v: 2;
  id: string;
  mode: Mode;
  scenarioId?: string;
  step: Step;
  question: string;
  subQuestions: SubQuestion[];
  /** The question the current plan was made for. */
  plannedFor?: string;
  planModel?: string;
  items: StoredItem[];
  nextId: number;
  analysis: Analysis | null;
  /** The run before this one, kept for "what changed". */
  previous: Analysis | null;
  /** Extraction results by source text + plan, so unchanged sources aren't re-sent to the AI. */
  extractCache: Record<string, ExtractResult>;
  checks: Checks;
  /** Topic the user is looking for a source for ("Find a source for this topic"). */
  verifyTarget?: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  question: string;
  mode: Mode;
  scenarioId?: string;
  savedAt: string;
  sources: number;
  counts?: Partial<Record<NodeStatus, number>>;
}

const CURRENT = "current";
const HISTORY = "history";
const MAX_HISTORY = 12;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function newSession(mode: Mode, scenarioId?: string): SessionData {
  return {
    v: 2,
    id: newId(),
    mode,
    scenarioId: mode === "sample" ? scenarioId : undefined,
    step: 1,
    question: "",
    subQuestions: [],
    items: [],
    nextId: 1,
    analysis: null,
    previous: null,
    extractCache: {},
    checks: {},
    updatedAt: new Date(0).toISOString(),
  };
}

export const planKey = (question: string, subQuestions: SubQuestion[]) =>
  hash(JSON.stringify([question.trim(), subQuestions.map((q) => [q.id, q.text.trim(), q.importance, q.volatility])]));

/** Changes whenever the plan, or any source's text, type or date, changes. */
export const inputsKey = (question: string, subQuestions: SubQuestion[], sources: Source[]) =>
  hash(planKey(question, subQuestions) + JSON.stringify(sources.map((s) => [s.id, hash(s.text), s.sourceType, s.publishedDate ?? ""])));

export const extractKey = (s: Source, plan: string) => `${s.id}|${hash(`${s.text}|${s.sourceType}|${s.publishedDate ?? ""}`)}|${plan}`;

export function isSession(x: unknown): x is SessionData {
  const s = x as SessionData;
  return !!s && s.v === 2 && typeof s.id === "string" && Array.isArray(s.items) && Array.isArray(s.subQuestions) && (s.mode === "live" || s.mode === "sample");
}

/** Items that were still loading when the page closed can't resume: mark them for retry. */
export function revive(s: SessionData): SessionData {
  return {
    ...s,
    items: s.items.map((it) => (it.status === "loading" ? { ...it, status: "error", error: "Interrupted when the page closed. Try again." } : it)),
    checks: s.checks ?? {},
    extractCache: s.extractCache ?? {},
  };
}

export const hasContent = (s: SessionData) => !!s.question.trim() && (s.subQuestions.length > 0 || s.items.length > 0 || !!s.analysis);

export async function loadCurrent(): Promise<SessionData | undefined> {
  const s = await getItem<unknown>(CURRENT);
  return isSession(s) ? revive(s) : undefined;
}

export const saveCurrent = (s: SessionData) => setItem(CURRENT, s);
export const clearCurrent = () => removeItem(CURRENT);

export async function listHistory(): Promise<HistoryEntry[]> {
  const h = await getItem<HistoryEntry[]>(HISTORY);
  return Array.isArray(h) ? h : [];
}

/** Keep a copy of a session in "Recent analyses" (newest first, at most 12). */
export async function saveToHistory(s: SessionData): Promise<HistoryEntry[]> {
  if (!hasContent(s)) return listHistory();
  const entry: HistoryEntry = {
    id: s.id,
    question: s.question.trim(),
    mode: s.mode,
    scenarioId: s.scenarioId,
    savedAt: new Date().toISOString(),
    sources: s.items.filter((i) => i.status === "ready").length,
    counts: s.analysis
      ? s.analysis.results.reduce<Partial<Record<NodeStatus, number>>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
      : undefined,
  };
  const list = [entry, ...(await listHistory()).filter((h) => h.id !== s.id)];
  for (const old of list.slice(MAX_HISTORY)) await removeItem(`session:${old.id}`);
  const kept = list.slice(0, MAX_HISTORY);
  await setItem(`session:${s.id}`, s);
  await setItem(HISTORY, kept);
  return kept;
}

export async function loadFromHistory(id: string): Promise<SessionData | undefined> {
  const s = await getItem<unknown>(`session:${id}`);
  return isSession(s) ? revive(s) : undefined;
}

export async function deleteFromHistory(id: string): Promise<HistoryEntry[]> {
  await removeItem(`session:${id}`);
  const kept = (await listHistory()).filter((h) => h.id !== id);
  await setItem(HISTORY, kept);
  return kept;
}

/** A saved analysis as a downloadable file, and back. */
export function exportSession(s: SessionData): Blob {
  return new Blob([JSON.stringify({ app: "GapMap", exportedAt: new Date().toISOString(), session: { ...s, extractCache: {} } }, null, 1)], {
    type: "application/json",
  });
}

export function importSession(text: string): SessionData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const s = (parsed as { session?: unknown })?.session;
  if (!isSession(s)) throw new Error("That file isn't a GapMap export.");
  return revive({ ...s, id: newId(), extractCache: {}, updatedAt: new Date().toISOString() });
}
