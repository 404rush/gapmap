"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Compass, FileJson, History, Printer, RefreshCw, RotateCcw } from "lucide-react";
import type { CheckState, Checks } from "@/lib/checks";
import { formatDateTime } from "@/lib/dates";
import type { Analysis } from "@/lib/types";
import { Checklist } from "../Checklist";
import { FactsLabel, type FindingsTab } from "../FactsLabel";
import { Findings } from "../Findings";
import { KnowledgeMap, MapLegend } from "../KnowledgeMap";
import { BasisChip, STATUS, SectionHead, btn, tagOf } from "../ui";
import { Tour, type TourStep } from "./Tour";

interface Props {
  a: Analysis;
  checks: Checks;
  setCheck: (key: string, v: CheckState) => void;
  onFindSource: (topicId: string) => void;
  onEditSources: () => void;
  onExport: () => void;
  stale: boolean;
  onRerun: () => void;
  canAddExtra: boolean;
}

export function Results({ a, checks, setCheck, onFindSource, onEditSources, onExport, stale, onRerun, canAddExtra }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<FindingsTab>("gaps");
  const [printing, setPrinting] = useState(false);
  const [touring, setTouring] = useState(false);

  // Print with every section expanded, then restore the view.
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 60);
    return () => clearTimeout(t);
  }, [printing]);

  const jumpToNode = (qid: string) => {
    setOpen((prev) => new Set(prev).add(qid));
    requestAnimationFrame(() => document.getElementById(`node-${qid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const jumpToTab = (t: FindingsTab) => {
    setTab(t);
    requestAnimationFrame(() => document.getElementById("findings-top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const openNode = (qid: string) => setOpen((prev) => new Set(prev).add(qid));

  const tourSteps = useMemo<TourStep[]>(() => {
    const steps: TourStep[] = [
      {
        target: "facts-label",
        title: "Information Facts: the analysis at a glance",
        body: "How many quotes were found word-for-word, how fresh the sources are, where they disagree and what's missing. Click a number to jump to it.",
      },
      {
        target: "map-section",
        title: "The knowledge map",
        body: "One branch per topic from the coverage plan, planned before any source was read. Status is shown by colour and pattern, and computed by fixed rules — not by the AI.",
      },
    ];
    const byStatus = (s: string) => a.results.find((r) => r.status === s);
    const contested =
      a.results.find((r) => r.status === "contested" && a.conflicts.some((c) => c.subQuestionId === r.subQuestionId && c.detectedBy === "rule")) ?? byStatus("contested");
    const outdated = byStatus("outdated");
    const gap = byStatus("gap");
    const nodeText = (id: string) => a.subQuestions.find((q) => q.id === id)?.text ?? "";
    if (contested)
      steps.push({
        target: `node-${contested.subQuestionId}`,
        prepare: () => openNode(contested.subQuestionId),
        title: "A possible conflict",
        body: `“${nodeText(contested.subQuestionId)}” — both sides are quoted word-for-word, with the likely reason and what would settle it.${
          a.conflicts.some((c) => c.subQuestionId === contested.subQuestionId && c.detectedBy === "rule")
            ? " “Number check” means GapMap's own rules caught it from the quoted numbers — even though the AI missed it."
            : " Tap a source tag or “View evidence” to see the quote highlighted on the page."
        }`,
      });
    if (outdated)
      steps.push({
        target: `node-${outdated.subQuestionId}`,
        prepare: () => openNode(outdated.subQuestionId),
        title: "Possibly outdated",
        body: "Sources disagree in a way that looks like old information. The newest official source is pulled out on top, and each source's date is shown with where it was found.",
      });
    if (gap)
      steps.push({
        target: `node-${gap.subQuestionId}`,
        prepare: () => openNode(gap.subQuestionId),
        title: "A potential gap",
        body: canAddExtra
          ? "None of the sources answer this. Try “Find a source for this topic”: add the sample's newer source, re-run, and the map shows what changed."
          : "None of the sources answer this — not proof it doesn't exist, only that these sources don't say. “Find a source for this topic” takes you back to add one.",
      });
    if (a.label.aiAnswers)
      steps.push({
        target: "findings-top",
        prepare: () => setTab("conflicts"),
        title: "Auditing the chatbot answer",
        body: "A pasted AI answer is checked like any source but never counted as evidence. Where the sources contradict it, it shows up under “AI answer vs sources”.",
      });
    steps.push({
      target: "verify-next",
      title: "Verify next",
      body: "A prioritised checklist for every gap, conflict and stale detail: where to check, what to search, and a ready-made question to ask. Tick items, add notes, download the report.",
    });
    return steps;
  }, [a, canAddExtra]);

  const changes = a.changes ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
        <span>Analysed {formatDateTime(a.generatedAt)}</span>
        <span>· {a.mode === "sample" ? "Sample sources (fictional)" : "Live sources"}</span>
        {a.model && <span>· AI: {a.model}</span>}
        <span>
          · {a.label.sourcesReviewed} source{a.label.sourcesReviewed === 1 ? "" : "s"}
          {a.label.aiAnswers ? ` + ${a.label.aiAnswers} AI answer` : ""}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-ink bg-white px-4 py-3 text-[13.5px]">
        <AlertTriangle size={17} aria-hidden className="shrink-0 text-outdated-ink" />
        <p className="min-w-[240px] flex-1">
          <span className="font-bold">These are signals to check, not verdicts.</span> Statuses come from quoted evidence and source dates. AI-written text is marked, and every
          finding opens the source behind it.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <BasisChip basis="sourced" />
          <BasisChip basis="ai" />
          <BasisChip basis="uncertain" />
        </div>
      </div>

      {stale && (
        <div role="status" className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-md border-2 border-outdated bg-[color-mix(in_srgb,var(--outdated)_8%,white)] px-4 py-3 text-[14px]">
          <History size={17} aria-hidden className="shrink-0 text-outdated-ink" />
          <p className="min-w-[220px] flex-1">
            <span className="font-bold">The plan or sources changed since this analysis.</span> These findings describe the earlier set.
          </p>
          <button type="button" className={btn.primary} onClick={onRerun}>
            <RefreshCw size={15} aria-hidden /> Re-run now
          </button>
        </div>
      )}

      {changes.length > 0 && (
        <section aria-label="Changes since the previous run" className="mb-6 rounded-md border-2 border-ai bg-white px-4 py-3">
          <h2 className="text-[14px] font-bold text-ai">What changed since the previous run</h2>
          <ul className="mt-1.5 space-y-1 text-[14px]">
            {changes.map((c) => {
              const i = a.subQuestions.findIndex((q) => q.id === c.subQuestionId);
              return (
                <li key={c.subQuestionId} className="flex flex-wrap items-center gap-x-2">
                  <button type="button" onClick={() => jumpToNode(c.subQuestionId)} className="font-semibold hover:underline">
                    Topic {i + 1}: {a.subQuestions[i]?.text}
                  </button>
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className={STATUS[c.from].tone}>{STATUS[c.from].short}</span>
                    <ArrowRight size={14} aria-label="became" />
                    <span className={`font-bold ${STATUS[c.to].tone}`}>{STATUS[c.to].short}</span>
                  </span>
                  {c.addedSourceIds.length > 0 && <span className="text-[13px] text-ink-3">after adding {c.addedSourceIds.map(tagOf).join(", ")}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[330px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-[76px] lg:self-start">
          <div id="facts-label" className="rounded-[2px]">
            <FactsLabel a={a} onJump={jumpToTab} />
          </div>
          <div className="no-print mt-3 flex flex-col items-start gap-1">
            {a.mode === "sample" && (
              <button type="button" onClick={() => setTouring(true)} className={`${btn.secondary} mb-1 w-full`}>
                <Compass size={15} aria-hidden /> Take the 1-minute tour
              </button>
            )}
            <button type="button" onClick={onEditSources} className={btn.ghost}>
              <RotateCcw size={14} aria-hidden /> Change sources and re-run
            </button>
            <button type="button" onClick={() => setPrinting(true)} className={btn.ghost}>
              <Printer size={14} aria-hidden /> Print or save as PDF
            </button>
            <button type="button" onClick={onExport} className={btn.ghost}>
              <FileJson size={14} aria-hidden /> Save this analysis (.json)
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-10">
          <section id="map-section" aria-labelledby="map-h" className="scroll-mt-24">
            <SectionHead step={4} title="Knowledge map" id="map-h">
              <MapLegend a={a} />
            </SectionHead>
            <p className="mb-4 max-w-[70ch] text-[14px] text-ink-2">
              Each branch is a topic from the coverage plan. Open one to see what each source says, the exact quotes, any disagreement, and why it got its status.
            </p>
            <KnowledgeMap a={a} open={open} setOpen={setOpen} onFindSource={onFindSource} printing={printing} />
          </section>

          <section id="findings-top" aria-labelledby="findings-h" className="scroll-mt-24 print-break">
            <h3 id="findings-h" className="display mb-3 text-[26px]">
              All findings
            </h3>
            <Findings a={a} tab={tab} setTab={setTab} onJumpToNode={jumpToNode} onFindSource={onFindSource} printing={printing} />
          </section>
        </div>
      </div>

      <section id="verify-next" aria-labelledby="verify-h" className="print-break mt-14 scroll-mt-24 border-t-2 border-ink pt-8">
        <SectionHead step={5} title="Verify next" id="verify-h" />
        <Checklist a={a} checks={checks} setCheck={setCheck} onFindSource={onFindSource} onJumpToNode={jumpToNode} onPrint={() => setPrinting(true)} />
      </section>

      {touring && <Tour steps={tourSteps} onClose={() => setTouring(false)} />}
    </div>
  );
}
