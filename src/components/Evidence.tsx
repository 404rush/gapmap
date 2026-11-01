"use client";

import { ArrowRightLeft, Calculator, ScanSearch } from "lucide-react";
import type { Claim, Conflict, ConflictReason } from "@/lib/types";
import { BasisChip, SourceDate, TypeTag, btn, tagOf, useEvidence } from "./ui";

/** One claim with its verbatim quote and source. */
export function ClaimRow({ claim, newest = false }: { claim: Claim; newest?: boolean }) {
  const { openClaim, sourceById } = useEvidence();
  const src = sourceById.get(claim.sourceId);
  const isAi = src?.sourceType === "ai-answer";
  const basis = claim.verified && !isAi ? "sourced" : "uncertain";
  return (
    <div className="rounded-md border border-rule bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BasisChip basis={basis} />
        {newest && <span className="chip bg-covered text-white" title="From the most recently dated source in this group">Newest</span>}
        <span className="text-[14px] font-semibold leading-snug">{claim.claim}</span>
      </div>
      <blockquote className="serif mt-2 text-[15.5px] leading-relaxed text-ink">
        <span className={claim.verified ? "mark" : "text-ink-3 line-through decoration-uncertain/60"}>&ldquo;{claim.quote}&rdquo;</span>
      </blockquote>
      {!claim.verified && <p className="mt-1.5 text-[12.5px] text-uncertain">This wording wasn&rsquo;t found on the page, so it isn&rsquo;t counted as evidence.</p>}
      {claim.verified && claim.matchKind === "ignoring-punctuation" && (
        <p className="mt-1.5 text-[12.5px] text-ink-3">Words match the page exactly; punctuation differs slightly.</p>
      )}
      {claim.verified && isAi && <p className="mt-1.5 text-[12.5px] text-uncertain">From the pasted AI answer. Audited, not used as evidence.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
        <span className="font-bold text-ink">{tagOf(claim.sourceId)}</span>
        <span className="max-w-[260px] truncate">{src?.title}</span>
        {src && <TypeTag type={src.sourceType} />}
        {src && <SourceDate s={src} />}
        {claim.timeReference && <span className="text-ink-3">Refers to: {claim.timeReference}</span>}
        <button type="button" onClick={() => openClaim(claim.id)} className={`${btn.link} ml-auto`}>
          <ScanSearch size={14} aria-hidden /> View evidence
        </button>
      </div>
    </div>
  );
}

export const REASON_TEXT: Record<ConflictReason, { label: string; cls: string }> = {
  "different-time": { label: "Likely different dates", cls: "bg-[color-mix(in_srgb,var(--outdated)_18%,white)] text-outdated-ink" },
  "different-scope": { label: "Likely different scope", cls: "bg-rule-soft text-ink" },
  "different-definition": { label: "Likely different definitions", cls: "bg-rule-soft text-ink" },
  genuine: { label: "Genuine disagreement", cls: "bg-[color-mix(in_srgb,var(--contested)_14%,white)] text-contested" },
  unclear: { label: "Reason unclear", cls: "bg-[color-mix(in_srgb,var(--contested)_14%,white)] text-contested" },
};

/** Disagreement Explainer card: both sides, the likely reason, how to settle it. */
export function ConflictCard({ conflict }: { conflict: Conflict }) {
  const { claimById, sourceById } = useEvidence();
  const date = (c: Claim) => sourceById.get(c.sourceId)?.publishedDate ?? "";
  const claims = (conflict.claimIds.map((id) => claimById.get(id)).filter(Boolean) as Claim[]).sort((a, b) => (date(b) > date(a) ? 1 : date(b) < date(a) ? -1 : 0));
  const dates = new Set(claims.map(date).filter(Boolean));
  const newestDate = claims.map(date).filter(Boolean).sort().at(-1);
  const involvesAi = claims.some((c) => sourceById.get(c.sourceId)?.sourceType === "ai-answer");
  const r = REASON_TEXT[conflict.likelyReason] ?? REASON_TEXT.unclear;
  return (
    <article className="rounded-lg border border-ink bg-sheet">
      <header className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5">
        <ArrowRightLeft size={16} className="text-contested" aria-hidden />
        <h4 className="text-[14px] font-bold">{involvesAi ? "AI answer vs sources" : "Possible conflict"}</h4>
        <span className={`chip ${r.cls}`}>{r.label}</span>
        <span className="chip bg-rule-soft text-ink-2">Confidence: {conflict.confidence}</span>
        <span className="ml-auto">
          {conflict.detectedBy === "rule" ? (
            <span className="chip bg-white text-ink ring-1 ring-ink" title="Found by GapMap's number check on the quoted text, not by the AI.">
              <Calculator size={11} aria-hidden /> Number check
            </span>
          ) : (
            <BasisChip basis="ai" />
          )}
        </span>
      </header>
      <div className="px-4 py-3">
        <p className="text-[14px] leading-snug">{conflict.summary}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {claims.map((c) => (
            <ClaimRow key={c.id} claim={c} newest={dates.size > 1 && !!newestDate && date(c) === newestDate} />
          ))}
        </div>
        <dl className="mt-3 grid gap-2 text-[13.5px] leading-snug sm:grid-cols-2">
          <div>
            <dt className="font-bold">Why they might differ</dt>
            <dd className="text-ink-2">{conflict.explanation || "No explanation given."}</dd>
          </div>
          <div>
            <dt className="font-bold">What would settle it</dt>
            <dd className="text-ink-2">{conflict.howToResolve || "Check the latest official source."}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
