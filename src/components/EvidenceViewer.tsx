"use client";

import { useEffect, useMemo, useRef } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { textFragmentUrl } from "@/lib/client/textFragment";
import { describeAge } from "@/lib/dates";
import { closestPassage } from "@/lib/quotes";
import type { Claim, Source } from "@/lib/types";
import { BasisChip, SampleTag, SourceDate, TypeTag, tagOf } from "./ui";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function EvidenceViewer({ source, claim, now, onClose }: { source: Source; claim?: Claim; now: Date; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const markRef = useRef<HTMLElement>(null);

  // Focus the dialog, trap Tab inside it, close on Escape, and give focus back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const t = setTimeout(() => markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const els = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [onClose, source.id, claim?.id]);

  const fictional = source.isSample || !!source.url?.includes(".example");
  const text = source.text;
  const hasHit = !!claim?.verified && claim.matchStart !== undefined && claim.matchEnd !== undefined;
  // For a quote that wasn't found: show where the page says something similar, clearly marked as not a match.
  const near = useMemo(() => (claim && !claim.verified ? closestPassage(text, claim.quote) : undefined), [claim, text]);
  const span = hasHit ? { start: claim!.matchStart!, end: claim!.matchEnd! } : near;
  const fragment = source.url && !fictional && hasHit ? textFragmentUrl(source.url, text.slice(claim!.matchStart, claim!.matchEnd)) : undefined;
  const isAi = source.sourceType === "ai-answer";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(23,34,48,0.55)] p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ev-title"
        className="flex max-h-[92vh] w-full max-w-[780px] flex-col overflow-hidden rounded-t-xl bg-sheet shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-rule px-5 pb-4 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink-3">Evidence · Source {tagOf(source.id)}</p>
              <h3 id="ev-title" className="display mt-1 text-[24px]">
                {source.title}
              </h3>
            </div>
            <button type="button" ref={closeRef} onClick={onClose} className="rounded-md p-1.5 text-ink-2 hover:bg-rule-soft" aria-label="Close evidence">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-2">
            <TypeTag type={source.sourceType} />
            {source.isSample && <SampleTag />}
            <span>{source.site}</span>
            <SourceDate s={source} />
            {source.publishedDate && <span className="text-ink-3">({describeAge(source.publishedDate, now)})</span>}
          </div>
          {source.dateEvidence && <p className="mt-1 text-[12px] text-ink-3">Date found in: {source.dateEvidence}</p>}
          {source.url &&
            (fictional ? (
              <p className="mt-1 text-[12px] text-ink-3">Fictional sample address: {source.url}</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {fragment && (
                  <a
                    href={fragment}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-ai underline"
                    title="Opens the page and, in browsers that support it, scrolls to and highlights the quote."
                  >
                    Open the original at this quote <ExternalLink size={13} aria-hidden />
                  </a>
                )}
                <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ai underline">
                  Open the original page <ExternalLink size={13} aria-hidden />
                </a>
              </div>
            ))}
          {source.via === "search-service" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <Search size={13} aria-hidden /> Text below is the search service&rsquo;s copy of the page, because the site blocked direct reading.
            </p>
          )}
          {source.note && <p className="mt-1.5 text-[12.5px] text-ai">{source.note}</p>}
        </header>

        {claim && (
          <div className="border-b border-rule bg-white px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <BasisChip basis={claim.verified && !isAi ? "sourced" : "uncertain"} />
              <span className="text-[14px] font-semibold">{claim.claim}</span>
            </div>
            {claim.verified && !isAi && (
              <p className="mt-1.5 text-[12.5px] text-ink-3">
                {claim.matchKind === "ignoring-punctuation"
                  ? "Highlighted below. The words match the page exactly; punctuation differs slightly."
                  : "Highlighted below: found word-for-word on this page."}
              </p>
            )}
            {!claim.verified && (
              <p className="mt-2 text-[13px] text-uncertain">
                The AI quoted &ldquo;{claim.quote}&rdquo;, but that wording was not found on this page, so GapMap treats the claim as uncertain and doesn&rsquo;t count it as
                evidence.
                {near ? " The passage with the most similar words is outlined below. It isn't a match, so check it yourself." : " No similar passage was found."}
              </p>
            )}
            {claim.verified && isAi && (
              <p className="mt-2 text-[13px] text-uncertain">This is what the AI answer said. It is audited against the other sources, not used as evidence.</p>
            )}
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4">
          <p className="serif whitespace-pre-wrap text-[16.5px] leading-[1.7] text-ink">
            {span ? (
              <>
                {text.slice(0, span.start)}
                <mark
                  ref={markRef}
                  className={hasHit ? "hit" : "rounded-sm bg-transparent px-0.5 text-ink outline-2 outline-offset-2 outline-dashed outline-uncertain"}
                  title={hasHit ? "The quoted passage" : "Closest passage (not a match)"}
                >
                  {text.slice(span.start, span.end)}
                </mark>
                {text.slice(span.end)}
              </>
            ) : (
              text
            )}
          </p>
          {source.isSample && (
            <p className="mt-4 border-t border-rule pt-3 text-[12px] text-ink-3">Sample source: fictional text written for this demo. No real organisation is represented.</p>
          )}
        </div>
      </div>
    </div>
  );
}
