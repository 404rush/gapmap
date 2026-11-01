import { hash } from "./hash";
import type { ChecklistItem } from "./types";

export interface CheckState {
  done: boolean;
  note?: string;
}
export type Checks = Record<string, CheckState>;

/** Ticks are keyed by the task text, so they carry over when the analysis is re-run. */
export const checkKey = (c: Pick<ChecklistItem, "task">) => hash(c.task.trim().toLowerCase());
