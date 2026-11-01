// GapMap shared types. Everything here is plain data so it can move between
// the browser and the API routes unchanged.  ﹏𓊝﹏

/** Where a statement in the interface comes from. Shown on every item. */
export type Basis = "sourced" | "ai" | "uncertain";

export type Importance = "critical" | "important" | "optional";
/** How quickly this kind of fact usually changes. Drives freshness checks. */
export type Volatility = "fast" | "medium" | "slow";

export interface SubQuestion {
  id: string;
  text: string;
  importance: Importance;
  volatility: Volatility;
  why: string;
}

export type SourceType =
  | "official"
  | "news"
  | "blog"
  | "forum"
  | "reference"
  | "academic"
  | "aggregator"
  | "ai-answer"
  | "document"
  | "other";

export type DateConfidence = "found" | "inferred" | "none";

/** How the text reached GapMap. */
export type SourceVia = "direct" | "search-service" | "pasted" | "upload" | "sample";

export interface Source {
  id: string;
  kind: "url" | "text" | "pdf" | "sample";
  url?: string;
  title: string;
  site: string;
  sourceType: SourceType;
  publishedDate?: string; // ISO yyyy-mm-dd
  dateLabel?: string; // e.g. "Last updated", "Published"
  dateEvidence?: string; // where the date was found
  dateConfidence: DateConfidence;
  cycleMentions: string[]; // e.g. ["2024-25"]
  text: string;
  fetchedAt: string;
  via?: SourceVia;
  isSample?: boolean;
  note?: string;
  /** Set when the user corrected the detected type or date. */
  userEdited?: { type?: boolean; date?: boolean };
}

/** Source without its full text, used in compact payloads. */
export type SourceMeta = Omit<Source, "text"> & { chars: number };

export type MatchKind = "exact" | "ignoring-punctuation";

export interface Claim {
  id: string;
  sourceId: string;
  subQuestionId: string;
  claim: string;
  quote: string;
  timeReference?: string;
  verified: boolean;
  matchKind?: MatchKind;
  matchStart?: number;
  matchEnd?: number;
}

export type ConflictReason =
  | "different-time"
  | "different-scope"
  | "different-definition"
  | "genuine"
  | "unclear";

export type Confidence = "low" | "medium" | "high";

export interface Conflict {
  id: string;
  subQuestionId: string;
  claimIds: string[];
  summary: string;
  likelyReason: ConflictReason;
  explanation: string;
  howToResolve: string;
  confidence: Confidence;
  /** "ai" = proposed by the AI and checked by rules; "rule" = found by the number check. */
  detectedBy: "ai" | "rule";
}

export type OutdatedKind = "old-date" | "check-soon" | "old-cycle" | "undated" | "superseded";

export interface OutdatedSignal {
  id: string;
  sourceId: string;
  claimId?: string;
  kind: OutdatedKind;
  reason: string;
  basis: Basis;
}

export interface OpenQuestion {
  id: string;
  question: string;
  raisedBySourceIds: string[];
  subQuestionId?: string;
}

export type NodeStatus = "covered" | "thin" | "outdated" | "contested" | "gap";

export interface SubQuestionResult {
  subQuestionId: string;
  status: NodeStatus;
  summary: string; // AI-written, cites claim ids
  claimIds: string[];
  reasons: string[]; // computed, plain-language reasons for the status
  independentOrigins: number;
  /** How far the evidence can be relied on, computed from origins, source types, dates and conflicts. */
  confidence: Confidence;
  confidenceReasons: string[];
  /** The verified claim from the most recently dated source, if any. */
  newestClaimId?: string;
}

export type ChecklistOrigin = "gap" | "conflict" | "outdated" | "open-question" | "single-source" | "general";

export interface ChecklistItem {
  id: string;
  priority: Importance;
  task: string;
  whereToVerify: string;
  searchQuery: string;
  why: string;
  askSource?: string;
  relatedIds: string[];
  /** Sub-question ids this item is about (resolved from relatedIds). */
  topicIds: string[];
  origin: ChecklistOrigin;
  /** Compared with the previous run of the same plan. */
  tag?: "new" | "still-open";
}

export interface IndependenceGroup {
  sourceIds: string[];
  similarity: number;
}

export type ExtractionStatus = "ok" | "no-claims" | "failed";

export interface SourceRunStatus {
  status: ExtractionStatus;
  error?: string;
  /** Long sources: only the most relevant excerpts were sent to the AI. */
  excerpted?: boolean;
  cached?: boolean;
}

export interface LabelStats {
  sourcesReviewed: number; // excluding pasted AI answers
  aiAnswers: number;
  sourcesNotAnalysed: number;
  independentOrigins: number;
  claims: { total: number; verified: number; unverified: number; fromAiAnswer: number };
  /** Kept for the summary bar: sourced = verified claims; uncertain = unverified + AI-answer claims + low-confidence conflicts. */
  sourcedCount: number;
  uncertainCount: number;
  aiCount: number;
  aiItems: { summaries: number; conflicts: number; openQuestions: number; checklist: number; notes: number };
  freshness: { fresh: number; checkSoon: number; outdated: number; undated: number };
  conflicts: { total: number; explained: number; unresolved: number; withAiAnswer: number; byRule: number };
  gaps: number;
  thinTopics: number;
  expectedTopics: number;
  openQuestions: number;
  coverage: number; // 0..1
  warnings: string[];
  ingredients: Record<string, number>;
}

/** What the AI analysis step returns (before the deterministic layer). */
export interface AiFindings {
  summaries: { subQuestionId: string; summary: string }[];
  conflicts: Omit<Conflict, "id" | "detectedBy">[];
  outdated: { sourceId: string; claimId?: string; reason: string }[];
  openQuestions: { question: string; raisedBySourceIds: string[]; subQuestionId?: string }[];
  checklist: Omit<ChecklistItem, "id" | "topicIds" | "tag">[];
}

export interface StatusChange {
  subQuestionId: string;
  from: NodeStatus;
  to: NodeStatus;
  addedSourceIds: string[];
}

export interface Analysis {
  question: string;
  generatedAt: string;
  mode: "live" | "sample";
  scenario?: string;
  model?: string;
  subQuestions: SubQuestion[];
  sources: SourceMeta[];
  sourceStatus: Record<string, SourceRunStatus>;
  claims: Claim[];
  conflicts: Conflict[];
  outdated: OutdatedSignal[];
  openQuestions: OpenQuestion[];
  results: SubQuestionResult[];
  checklist: ChecklistItem[];
  independence: IndependenceGroup[];
  label: LabelStats;
  freshnessBySource: Record<string, Freshness>;
  /** Hash of the plan and source texts this analysis was built from. */
  inputsKey?: string;
  /** Status changes since the previous run of the same plan. */
  changes?: StatusChange[];
}

export type Freshness = "fresh" | "check-soon" | "outdated" | "undated";
