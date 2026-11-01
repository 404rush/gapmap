import type { AiFindings, Claim, SourceType, SubQuestion } from "../types";

export interface RawSource {
  id: string;
  title: string;
  site: string;
  url?: string;
  type: SourceType;
  text: string;
}

export type RawClaim = Omit<Claim, "verified" | "matchStart" | "matchEnd" | "matchKind">;

/**
 * A fictional, clearly labelled scenario with saved AI outputs, so the whole
 * workflow can be shown without API keys. The deterministic layer (dates,
 * quote checks, copy and number checks, statuses, checklist rules) runs live.
 */
export interface SampleScenario {
  id: string;
  title: string;
  blurb: string;
  question: string;
  subQuestions: SubQuestion[];
  raw: RawSource[];
  claims: RawClaim[];
  raised: { sourceId: string; question: string }[];
  ai: AiFindings;
  /** An extra source the user can add from the checklist to see a gap close. */
  extra?: { source: RawSource; claims: RawClaim[]; topicIds: string[]; patch: (ai: AiFindings) => AiFindings };
}
