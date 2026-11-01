"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, Plus } from "lucide-react";
import type { Analysis, NodeStatus } from "@/lib/types";
import { ClaimRow, ConflictCard } from "./Evidence";
import { BasisChip, CitedText, ConfidenceTag, ImportanceTag, STATUS, StatusSwatch, btn, tagOf } from "./ui";

const ORDER: NodeStatus[] = ["covered", "thin", "outdated", "contested", "gap"];

export function MapLegend({ a }: { a: Analysis }) {
  const counts = Object.fromEntries(ORDER.map((s) => [s, a.results.filter((r) => r.status === s).length]));
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]" aria-label="Map legend">
      {ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5" title={STATUS[s].desc}>
          <StatusSwatch status={s} />
          <span className="font-semibold">{STATUS[s].label}</span>
          <span className="text-ink-3">{counts[s]}</span>
        </li>
      ))}
    </ul>
  );
}

interface MapProps {
  a: Analysis;
  open: Set<string>;
  setOpen: (s: Set<string>) => void;
  onFindSource?: (topicId: string) => void;
  printing?: boolean;
}

/** One tile per topic: the whole map at a glance; click to jump. */
function Overview({ a, onJump }: { a: Analysis; onJump: (id: string) => void }) {
  return (
    <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7" aria-label="Topics at a glance">
      {a.subQuestions.map((q, i) => {
        const r = a.results.find((x) => x.subQuestionId === q.id)!;
        return (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onJump(q.id)}
              className="flex h-full w-full items-start gap-2 rounded-md border border-rule bg-sheet p-2 text-left hover:border-ink"
              title={`${q.text} — ${STATUS[r.status].label}`}
            >
              <StatusSwatch status={r.status} size={16} />
              <span className="min-w-0">
                <span className="block text-[11.5px] font-bold text-ink-3">Topic {i + 1}</span>
                <span className={`block text-[12px] font-semibold leading-tight ${STATUS[r.status].tone}`}>{STATUS[r.status].short}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function KnowledgeMap({ a, open, setOpen, onFindSource, printing = false }: MapProps) {
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };
  const jump = (id: string) => {
    setOpen(new Set(open).add(id));
    requestAnimationFrame(() => document.getElementById(`node-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const allOpen = a.subQuestions.every((q) => open.has(q.id));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 no-print">
        <p className="text-[12.5px] font-bold text-ink-3">At a glance</p>
        <button type="button" className={btn.ghost} onClick={() => setOpen(allOpen ? new Set() : new Set(a.subQuestions.map((q) => q.id)))}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="no-print mb-4">
        <Overview a={a} onJump={jump} />
      </div>
      <div className="reveal-map">
        <div className="rounded-md bg-ink px-4 py-3 text-white">
          <p className="text-[12px] font-semibold text-white/70">Your question</p>
          <p className="display mt-0.5 text-[22px] sm:text-[25px]" style={{ fontStretch: "80%", fontWeight: 700 }}>
            {a.question}
          </p>
        </div>
        <ul className="tree mt-0 space-y-3 pt-3">
          {a.subQuestions.map((q, i) => (
            <MapNode key={q.id} a={a} qid={q.id} index={i} open={printing || open.has(q.id)} onToggle={() => toggle(q.id)} onFindSource={onFindSource} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function MapNode({
  a,
  qid,
  index,
  open,
  onToggle,
  onFindSource,
}: {
  a: Analysis;
  qid: string;
  index: number;
  open: boolean;
  onToggle: () => void;
  onFindSource?: (topicId: string) => void;
}) {
  const q = a.subQuestions.find((x) => x.id === qid)!;
  const r = a.results.find((x) => x.subQuestionId === qid)!;
  const status = r.status;
  const claims = a.claims.filter((c) => c.subQuestionId === qid);
  const conflicts = a.conflicts.filter((c) => c.subQuestionId === qid);
  const opens = a.openQuestions.filter((o) => o.subQuestionId === qid);
  const change = a.changes?.find((c) => c.subQuestionId === qid);
  const st = STATUS[status];
  const aiSources = new Set(a.sources.filter((s) => s.sourceType === "ai-answer").map((s) => s.id));
  const quoteCount = claims.filter((c) => c.verified && !aiSources.has(c.sourceId)).length;
  const newest = r.newestClaimId ? a.claims.find((c) => c.id === r.newestClaimId) : undefined;
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? claims : claims.slice(0, 4);
  const bodyId = `node-body-${qid}`;

  return (
    <li id={`node-${qid}`} className="scroll-mt-24">
      <div className="node overflow-hidden" data-status={status} data-open={open}>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId} className="flex w-full items-stretch text-left">
          <span aria-hidden className={`w-3 shrink-0 ${st.pat}`} />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3">
            <span className="min-w-0 flex-1 basis-[260px]">
              <span className="block text-[15.5px] font-semibold leading-snug">
                <span className="mr-1.5 text-ink-3">{index + 1}.</span>
                {q.text}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={`text-[13px] font-bold ${st.tone}`}>{st.label}</span>
                {change && (
                  <span className="chip bg-[color-mix(in_srgb,var(--ai)_10%,white)] text-ai" title="Changed since the previous run">
                    was: {STATUS[change.from].short}
                  </span>
                )}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
              <ImportanceTag value={q.importance} />
              <ConfidenceTag value={r.confidence} reasons={r.confidenceReasons} />
              <span>
                {quoteCount} quote{quoteCount === 1 ? "" : "s"} · {r.independentOrigins} origin{r.independentOrigins === 1 ? "" : "s"}
              </span>
              <ChevronDown size={18} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </span>
        </button>

        {open && (
          <div id={bodyId} className="space-y-4 border-t border-rule bg-[color-mix(in_srgb,var(--paper)_45%,white)] px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-bold text-ink-3">Why this status</p>
                <ul className="mt-1 list-disc pl-5 text-[14px]">
                  {r.reasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink-3">Why this confidence</p>
                <ul className="mt-1 list-disc pl-5 text-[14px]">
                  {r.confidenceReasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[12px] text-ink-3 sm:col-span-2">Computed by GapMap from the quoted evidence, source types and dates — not written by the AI.</p>
            </div>

            {newest && (status === "outdated" || status === "contested") && (
              <div className="rounded-md border border-covered/40 bg-white p-3 text-[14px]">
                <p className="text-[12px] font-bold text-covered">Newest {a.sources.find((s) => s.id === newest.sourceId)?.sourceType === "official" ? "official " : ""}source says</p>
                <p className="mt-0.5">
                  {newest.claim} <span className="font-bold">({tagOf(newest.sourceId)})</span>
                </p>
              </div>
            )}

            {r.summary && (
              <div className="rounded-md border border-[color-mix(in_srgb,var(--ai)_30%,white)] bg-white p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <BasisChip basis="ai" />
                  <span className="text-[12px] text-ink-3">Summary of what the sources say. Tap a source tag to see its quote.</span>
                </div>
                <p className="text-[14.5px] leading-relaxed">
                  <CitedText text={r.summary} />
                </p>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="space-y-3">
                {conflicts.map((c) => (
                  <ConflictCard key={c.id} conflict={c} />
                ))}
              </div>
            )}

            {status === "gap" && (
              <div className="rounded-md border-2 border-dashed border-gap bg-white p-3 text-[14px]">
                <p className="font-bold">Potential gap: not found in the sources reviewed.</p>
                <p className="mt-0.5 text-ink-2">This doesn&rsquo;t mean the answer doesn&rsquo;t exist — only that none of these sources state it. {q.why}</p>
              </div>
            )}

            {onFindSource && status !== "covered" && (
              <button type="button" onClick={() => onFindSource(q.id)} className={`${btn.secondary} no-print`}>
                <Plus size={15} aria-hidden /> Find a source for this topic
              </button>
            )}

            {claims.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] font-bold text-ink-3">Extracted from sources ({claims.length})</p>
                <div className="space-y-2">
                  {shown.map((c) => (
                    <ClaimRow key={c.id} claim={c} />
                  ))}
                </div>
                {claims.length > 4 && (
                  <button type="button" onClick={() => setShowAll(!showAll)} className={`${btn.link} no-print mt-2`}>
                    {showAll ? "Show fewer" : `Show all ${claims.length}`}
                  </button>
                )}
              </div>
            )}

            {opens.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-bold text-ink-3">Still unanswered</p>
                <ul className="space-y-1.5">
                  {opens.map((o) => (
                    <li key={o.id} className="flex items-start gap-2 text-[14px]">
                      <HelpCircle size={16} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
                      <span>{o.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
