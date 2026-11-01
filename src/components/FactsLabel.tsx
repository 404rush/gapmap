"use client";

import type { ReactNode } from "react";
import type { Analysis } from "@/lib/types";

export type FindingsTab = "gaps" | "conflicts" | "outdated" | "questions" | "sources";

function Num({ n, tab, alert, onJump, children }: { n: number; tab?: FindingsTab; alert?: string; onJump?: (t: FindingsTab) => void; children?: ReactNode }) {
  const cls = `font-bold ${n && alert ? alert : ""}`;
  const body = children ?? n;
  if (!onJump || !tab) return <span className={cls}>{body}</span>;
  return (
    <button type="button" onClick={() => onJump(tab)} className={`${cls} underline decoration-rule decoration-1 underline-offset-2 hover:decoration-ink`} title="Show in findings">
      {body}
    </button>
  );
}

/** The Information Facts panel: the whole analysis at a glance, styled like a nutrition label. */
export function FactsLabel({ a, onJump }: { a: Analysis; onJump?: (tab: FindingsTab) => void }) {
  const L = a.label;
  const claimTotal = L.claims.verified + L.claims.unverified + L.claims.fromAiAnswer || 1;
  const pct = (n: number) => `${(n / claimTotal) * 100}%`;
  const covPct = Math.round(L.coverage * 100);
  const aiSrc = new Set(a.sources.filter((s) => s.sourceType === "ai-answer").map((s) => s.id));
  const claimSrc = new Map(a.claims.map((c) => [c.id, c.sourceId]));
  const ruleBetweenSources = a.conflicts.filter((c) => c.detectedBy === "rule" && !c.claimIds.some((id) => aiSrc.has(claimSrc.get(id) ?? ""))).length;


  return (
    <section aria-label="Information Facts summary" className="facts">
      <h2 className="display text-[38px] leading-none" style={{ fontStretch: "68%", fontWeight: 900 }}>
        Information Facts
      </h2>
      <p className="mt-1 text-[12.5px] leading-snug">
        <span className="font-bold">Question:</span> {a.question}
      </p>
      <div className="row mt-1 border-t-0">
        <span className="font-bold">Sources reviewed</span>
        <Num onJump={onJump} n={L.sourcesReviewed} tab="sources" />
      </div>
      {L.aiAnswers > 0 && (
        <div className="row sub">
          <span>
            AI answer audited <span className="text-[11px]">(not counted as a source)</span>
          </span>
          <span>{L.aiAnswers}</span>
        </div>
      )}
      {L.sourcesNotAnalysed > 0 && (
        <div className="row sub">
          <span>Couldn&rsquo;t be analysed</span>
          <Num onJump={onJump} n={L.sourcesNotAnalysed} tab="sources" alert="text-contested" />
        </div>
      )}
      <div className="rule-xl" />

      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold">Claims extracted</p>
        <p className="text-[11px] font-bold">{L.claims.total}</p>
      </div>
      <div className="mt-1 flex h-3 w-full overflow-hidden rounded-sm border border-ink" aria-hidden>
        <span style={{ width: pct(L.claims.verified) }} className="bg-ink" />
        <span style={{ width: pct(L.claims.unverified) }} className="bg-[repeating-linear-gradient(90deg,var(--uncertain)_0_3px,white_3px_5px)]" />
        <span style={{ width: pct(L.claims.fromAiAnswer) }} className="bg-[color-mix(in_srgb,var(--ai)_45%,white)]" />
      </div>
      <div className="row mt-1.5">
        <span>
          <span className="font-bold">Quoted word-for-word</span> <span className="text-[11px]">(sourced)</span>
        </span>
        <span className="font-bold">{L.claims.verified}</span>
      </div>
      <div className="row">
        <span>
          <span className="font-bold text-uncertain">Quote not found on page</span> <span className="text-[11px]">(not counted)</span>
        </span>
        <span className="font-bold">{L.claims.unverified}</span>
      </div>
      {L.aiAnswers > 0 && (
        <div className="row">
          <span>
            <span className="font-bold text-ai">From the pasted AI answer</span> <span className="text-[11px]">(audited)</span>
          </span>
          <span className="font-bold">{L.claims.fromAiAnswer}</span>
        </div>
      )}
      <div className="row">
        <span>
          <span className="font-bold text-ai">AI-written notes</span> <span className="text-[11px]">(summaries, explanations, next steps — signals to check)</span>
        </span>
        <span className="font-bold">{L.aiCount}</span>
      </div>
      <div className="rule-md" />

      <div className="row border-t-0">
        <span className="font-bold">Independent origins</span>
        <Num onJump={onJump} n={L.independentOrigins} tab="sources">
          {L.independentOrigins} of {L.sourcesReviewed}
        </Num>
      </div>
      <div className="row">
        <span className="font-bold">Source freshness</span>
        {onJump ? (
          <Num onJump={onJump} n={0} tab="outdated">
            <span className="text-[11px]">See dates</span>
          </Num>
        ) : (
          <span />
        )}
      </div>
      <div className="row sub">
        <span>Fresh</span>
        <span>{L.freshness.fresh}</span>
      </div>
      <div className="row sub">
        <span>Check soon</span>
        <span>{L.freshness.checkSoon}</span>
      </div>
      <div className="row sub">
        <span>Possibly outdated</span>
        <span className={L.freshness.outdated ? "font-bold text-outdated-ink" : ""}>{L.freshness.outdated}</span>
      </div>
      <div className="row sub">
        <span>Undated</span>
        <span className={L.freshness.undated ? "font-bold text-uncertain" : ""}>{L.freshness.undated}</span>
      </div>
      <div className="row">
        <span className="font-bold">Possible conflicts between sources</span>
        <Num onJump={onJump} n={L.conflicts.total} tab="conflicts" />
      </div>
      <div className="row sub">
        <span>Likely explained by dates</span>
        <span>{L.conflicts.explained}</span>
      </div>
      <div className="row sub">
        <span>Unresolved</span>
        <span className={L.conflicts.unresolved ? "font-bold text-contested" : ""}>{L.conflicts.unresolved}</span>
      </div>
      {ruleBetweenSources > 0 && (
        <div className="row sub">
          <span>Caught by the number check</span>
          <span>{ruleBetweenSources}</span>
        </div>
      )}
      {L.aiAnswers > 0 && (
        <div className="row">
          <span className="font-bold">AI answer contradicted by sources</span>
          <Num onJump={onJump} n={L.conflicts.withAiAnswer} tab="conflicts" alert="text-contested" />
        </div>
      )}
      <div className="row">
        <span className="font-bold">Potential gaps</span>
        <Num onJump={onJump} n={L.gaps} tab="gaps">
          {L.gaps} of {L.expectedTopics} topics
        </Num>
      </div>
      <div className="row">
        <span className="font-bold">Single source only</span>
        <Num onJump={onJump} n={L.thinTopics} tab="gaps">
          {L.thinTopics} of {L.expectedTopics} topics
        </Num>
      </div>
      <div className="row">
        <span className="font-bold">Unanswered questions</span>
        <Num onJump={onJump} n={L.openQuestions} tab="questions" />
      </div>
      <div className="rule-md" />
      <div className="row border-t-0">
        <span>
          <span className="font-bold">Coverage</span> <span className="text-[11px]">(topics with at least one source)</span>
        </span>
        <span className="font-bold">{covPct}%</span>
      </div>
      <div className="h-2.5 w-full border border-ink" aria-hidden>
        <div className="h-full bg-ink" style={{ width: `${covPct}%` }} />
      </div>
      <div className="rule-xl" />

      {L.warnings.length > 0 && (
        <p className="text-[12px] leading-snug">
          <span className="font-bold">Warnings: </span>
          {L.warnings.join("; ")}.
        </p>
      )}
      {Object.keys(L.ingredients).length > 0 && (
        <p className="mt-2 border-t border-ink pt-1.5 text-[12px] leading-snug">
          <span className="font-bold">Ingredients: </span>
          {Object.entries(L.ingredients)
            .map(([k, v]) => `${k} (${v})`)
            .join(", ")}
          .
        </p>
      )}
      <p className="mt-2 text-[10.5px] leading-snug text-ink-2">
        Counts are signals produced by GapMap, not verdicts. Statuses are computed from quoted evidence by fixed rules; AI-written text is marked as a suggestion.
      </p>
    </section>
  );
}
