"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, Copy, FileText, HelpCircle, Layers, Plus, RotateCcw, ScanSearch, Search, Scissors } from "lucide-react";
import { describeAge } from "@/lib/dates";
import type { Analysis, Conflict, Freshness, OutdatedKind, OutdatedSignal, SubQuestionResult } from "@/lib/types";
import { ConflictCard } from "./Evidence";
import type { FindingsTab } from "./FactsLabel";
import { SourceTimeline } from "./Timeline";
import { BasisChip, ImportanceTag, SampleTag, SourceDate, StatusSwatch, TabList, TabPanel, TypeTag, btn, tagOf, useEvidence, useIdBase } from "./ui";

const FRESH: Record<Freshness, { label: string; cls: string }> = {
  fresh: { label: "Fresh", cls: "text-covered" },
  "check-soon": { label: "Check soon", cls: "text-outdated-ink" },
  outdated: { label: "Possibly outdated", cls: "text-outdated-ink font-bold" },
  undated: { label: "Undated", cls: "text-uncertain font-bold" },
};

const KIND: Record<OutdatedKind, { label: string; icon: ReactNode }> = {
  "old-date": { label: "Old date", icon: <CalendarClock size={16} aria-hidden /> },
  "check-soon": { label: "Check soon", icon: <CalendarClock size={16} aria-hidden /> },
  "old-cycle": { label: "Earlier cycle", icon: <Layers size={16} aria-hidden /> },
  undated: { label: "No date", icon: <HelpCircle size={16} aria-hidden /> },
  superseded: { label: "Possibly superseded", icon: <RotateCcw size={16} aria-hidden /> },
};

interface Props {
  a: Analysis;
  tab: FindingsTab;
  setTab: (t: FindingsTab) => void;
  onJumpToNode: (qid: string) => void;
  onFindSource?: (qid: string) => void;
  /** Render every section one after another (for printing). */
  printing?: boolean;
}

function split(a: Analysis) {
  const aiSrc = new Set(a.sources.filter((s) => s.sourceType === "ai-answer").map((s) => s.id));
  const claimSrc = new Map(a.claims.map((c) => [c.id, c.sourceId]));
  const involvesAi = (c: Conflict) => c.claimIds.some((id) => aiSrc.has(claimSrc.get(id) ?? ""));
  return {
    between: a.conflicts.filter((c) => !involvesAi(c)),
    vsAi: a.conflicts.filter(involvesAi),
    gaps: a.results.filter((r) => r.status === "gap"),
    thin: a.results.filter((r) => r.status === "thin"),
    flaggedSources: [...new Set(a.outdated.map((o) => o.sourceId))],
  };
}

export function Findings({ a, tab, setTab, onJumpToNode, onFindSource, printing = false }: Props) {
  const idBase = useIdBase("findings");
  const s = split(a);
  const tabs: { id: FindingsTab; label: string; n: number }[] = [
    { id: "gaps", label: "Gaps & single-source", n: s.gaps.length + s.thin.length },
    { id: "conflicts", label: "Possible conflicts", n: a.conflicts.length },
    { id: "outdated", label: "Dates & freshness", n: s.flaggedSources.length },
    { id: "questions", label: "Unanswered questions", n: a.openQuestions.length },
    { id: "sources", label: "Sources", n: a.sources.length },
  ];
  const body = (t: FindingsTab) =>
    t === "gaps" ? (
      <GapsTab a={a} gaps={s.gaps} thin={s.thin} onJumpToNode={onJumpToNode} onFindSource={onFindSource} />
    ) : t === "conflicts" ? (
      <ConflictsTab a={a} between={s.between} vsAi={s.vsAi} />
    ) : t === "outdated" ? (
      <OutdatedTab a={a} printing={printing} />
    ) : t === "questions" ? (
      <QuestionsTab a={a} onJumpToNode={onJumpToNode} onFindSource={onFindSource} />
    ) : (
      <SourcesTab a={a} />
    );

  if (printing)
    return (
      <div className="space-y-6">
        {tabs.map((t) => (
          <section key={t.id}>
            <h3 className="mb-2 border-b-2 border-ink pb-1 text-[17px] font-bold">
              {t.label} ({t.n})
            </h3>
            {body(t.id)}
          </section>
        ))}
      </div>
    );

  return (
    <div>
      <TabList
        tabs={tabs.map((t) => ({
          id: t.id,
          label: (
            <>
              {t.label} <span className="ml-1 rounded bg-rule-soft px-1.5 text-[12px] text-ink">{t.n}</span>
            </>
          ),
        }))}
        value={tab}
        onChange={setTab}
        label="Findings"
        idBase={idBase}
        className="flex gap-1 overflow-x-auto border-b-2 border-ink"
        tabClass={(on) => `-mb-[2px] shrink-0 rounded-t-md px-3.5 py-2 text-[14px] font-semibold ${on ? "border-2 border-b-0 border-ink bg-sheet text-ink" : "text-ink-2 hover:text-ink"}`}
      />
      <TabPanel idBase={idBase} active={tab} className="rounded-b-md border-2 border-t-0 border-ink bg-sheet p-4">
        {body(tab)}
      </TabPanel>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-[14px] text-ink-3">{text}</p>;
}

function SubHead({ children, n }: { children: ReactNode; n: number }) {
  return (
    <h4 className="mb-2 mt-1 flex items-baseline gap-2 text-[14px] font-bold">
      {children} <span className="rounded bg-rule-soft px-1.5 text-[12px] font-semibold">{n}</span>
    </h4>
  );
}

function TopicRow({
  a,
  r,
  onJumpToNode,
  onFindSource,
}: {
  a: Analysis;
  r: SubQuestionResult;
  onJumpToNode: (qid: string) => void;
  onFindSource?: (qid: string) => void;
}) {
  const q = a.subQuestions.find((x) => x.id === r.subQuestionId)!;
  return (
    <li className="flex flex-wrap items-start gap-3 rounded-md border border-rule bg-white p-3">
      <StatusSwatch status={r.status} size={18} />
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className="text-[14.5px] font-semibold">{q.text}</p>
        <p className="text-[13px] text-ink-2">{r.reasons.join(" ")}</p>
        <p className="mt-0.5 text-[13px] text-ink-3">Why it matters: {q.why}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ImportanceTag value={q.importance} />
        <button type="button" onClick={() => onJumpToNode(q.id)} className={`${btn.link} no-print`}>
          Show on map
        </button>
        {onFindSource && (
          <button type="button" onClick={() => onFindSource(q.id)} className={`${btn.link} no-print`}>
            <Plus size={14} aria-hidden /> Find a source
          </button>
        )}
      </div>
    </li>
  );
}

function GapsTab({
  a,
  gaps,
  thin,
  onJumpToNode,
  onFindSource,
}: {
  a: Analysis;
  gaps: SubQuestionResult[];
  thin: SubQuestionResult[];
  onJumpToNode: (qid: string) => void;
  onFindSource?: (qid: string) => void;
}) {
  if (!gaps.length && !thin.length) return <Empty text="Every planned topic is covered by at least two independent sources." />;
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-2">
        These are topics a complete answer should cover (planned before any source was read) that the sources leave empty or that rest on a single origin. A gap means &ldquo;not found in
        these sources&rdquo;, not &ldquo;doesn&rsquo;t exist&rdquo;.
      </p>
      <div>
        <SubHead n={gaps.length}>Potential gaps</SubHead>
        {gaps.length ? (
          <ul className="space-y-2.5">
            {gaps.map((r) => (
              <TopicRow key={r.subQuestionId} a={a} r={r} onJumpToNode={onJumpToNode} onFindSource={onFindSource} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">None. Every topic has at least one source.</p>
        )}
      </div>
      <div>
        <SubHead n={thin.length}>Single source only</SubHead>
        {thin.length ? (
          <ul className="space-y-2.5">
            {thin.map((r) => (
              <TopicRow key={r.subQuestionId} a={a} r={r} onJumpToNode={onJumpToNode} onFindSource={onFindSource} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">None.</p>
        )}
      </div>
    </div>
  );
}

function ConflictsTab({ a, between, vsAi }: { a: Analysis; between: Conflict[]; vsAi: Conflict[] }) {
  if (!a.conflicts.length) return <Empty text="No conflicts detected between these sources. That's a signal too, not proof: the sources may share an origin." />;
  const hasAi = a.label.aiAnswers > 0;
  return (
    <div className="space-y-5">
      <div>
        <SubHead n={between.length}>Between sources</SubHead>
        {between.length ? (
          <div className="space-y-3">
            {between.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-ink-3">The sources don&rsquo;t contradict each other on anything checked.</p>
        )}
      </div>
      {hasAi && (
        <div>
          <SubHead n={vsAi.length}>AI answer vs sources</SubHead>
          <p className="mb-2 text-[13px] text-ink-2">Where the pasted AI answer says something the sources don&rsquo;t support.</p>
          {vsAi.length ? (
            <div className="space-y-3">
              {vsAi.map((c) => (
                <ConflictCard key={c.id} conflict={c} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">No contradictions found between the AI answer and the sources.</p>
          )}
        </div>
      )}
    </div>
  );
}

function OutdatedTab({ a, printing }: { a: Analysis; printing: boolean }) {
  const { openSource, openClaim, sourceById } = useEvidence();
  const bySource = new Map<string, OutdatedSignal[]>();
  for (const o of a.outdated) bySource.set(o.sourceId, [...(bySource.get(o.sourceId) ?? []), o]);
  const now = new Date(a.generatedAt);
  return (
    <div className="space-y-4">
      {!printing && <SourceTimeline a={a} />}
      {!bySource.size && <Empty text="No dating problems found. All sources are recent and dated." />}
      <ul className="space-y-2.5">
        {[...bySource.entries()].map(([sid, signals]) => {
          const s = sourceById.get(sid);
          return (
            <li key={sid} className="rounded-md border border-rule bg-white p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="display text-[19px]">{tagOf(sid)}</span>
                <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug">{s?.title}</span>
                <button type="button" onClick={() => openSource(sid)} className={`${btn.link} no-print`}>
                  <FileText size={14} aria-hidden /> Read source
                </button>
              </div>
              {s && (
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-ink-3">
                  <TypeTag type={s.sourceType} />
                  <SourceDate s={s} />
                  {s.publishedDate && <span>· {describeAge(s.publishedDate, now)}</span>}
                  {s.cycleMentions.length > 0 && <span>· mentions {s.cycleMentions.join(", ")}</span>}
                  {s.publishedDate && <span className={FRESH[a.freshnessBySource[sid]].cls}>· {FRESH[a.freshnessBySource[sid]].label}</span>}
                </p>
              )}
              <ul className="mt-2 space-y-2 border-t border-rule-soft pt-2">
                {signals.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-start gap-2.5">
                    <span className="mt-0.5 text-outdated-ink">{KIND[o.kind].icon}</span>
                    <div className="min-w-0 flex-1 basis-[220px]">
                      <span className="mr-2 text-[13.5px] font-bold">{KIND[o.kind].label}</span>
                      <BasisChip basis={o.basis} />
                      <p className="mt-0.5 text-[14px]">{o.reason}</p>
                    </div>
                    {o.claimId && (
                      <button type="button" onClick={() => openClaim(o.claimId!)} className={`${btn.link} no-print`}>
                        <ScanSearch size={14} aria-hidden /> View evidence
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      <p className="text-[12.5px] text-ink-3">
        Freshness compares each source&rsquo;s date with how quickly its topics usually change: fast-changing facts (deadlines, fees, rates) go stale sooner than rules or
        background. &ldquo;Earlier cycle&rdquo; means the text names a year or session that has already ended.
      </p>
    </div>
  );
}

function QuestionsTab({ a, onJumpToNode, onFindSource }: { a: Analysis; onJumpToNode: (qid: string) => void; onFindSource?: (qid: string) => void }) {
  if (!a.openQuestions.length) return <Empty text="No unanswered questions were raised." />;
  return (
    <ul className="space-y-2.5">
      {a.openQuestions.map((o) => (
        <li key={o.id} className="flex flex-wrap items-start gap-3 rounded-md border border-rule bg-white p-3">
          <HelpCircle size={18} aria-hidden className="mt-0.5 text-ink-3" />
          <div className="min-w-0 flex-1 basis-[240px]">
            <p className="text-[14.5px] font-semibold">{o.question}</p>
            <p className="text-[12.5px] text-ink-3">
              {o.raisedBySourceIds.length
                ? `Raised by ${o.raisedBySourceIds.map(tagOf).join(", ")} but not answered by any source.`
                : "Suggested by the AI from what the sources leave out."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BasisChip basis="ai" />
            {o.subQuestionId && (
              <button type="button" onClick={() => onJumpToNode(o.subQuestionId!)} className={`${btn.link} no-print`}>
                Show on map
              </button>
            )}
            {o.subQuestionId && onFindSource && (
              <button type="button" onClick={() => onFindSource(o.subQuestionId!)} className={`${btn.link} no-print`}>
                <Plus size={14} aria-hidden /> Find a source
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SourcesTab({ a }: { a: Analysis }) {
  const { openSource } = useEvidence();
  const group = (id: string) => a.independence.find((g) => g.sourceIds.includes(id));
  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {a.sources.map((s) => {
          const g = group(s.id);
          const fr = FRESH[a.freshnessBySource[s.id]];
          const n = a.claims.filter((c) => c.sourceId === s.id).length;
          const v = a.claims.filter((c) => c.sourceId === s.id && c.verified).length;
          const st = a.sourceStatus[s.id];
          return (
            <li key={s.id} className="flex flex-wrap items-start gap-3 rounded-md border border-rule bg-white p-3">
              <span className="display mt-0.5 w-8 text-[20px]">{tagOf(s.id)}</span>
              <div className="min-w-0 flex-1 basis-[240px]">
                <p className="text-[14.5px] font-semibold leading-snug">{s.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
                  <TypeTag type={s.sourceType} />
                  {s.isSample && <SampleTag />}
                  <span>{s.site}</span>
                  <SourceDate s={s} />
                  {s.sourceType !== "ai-answer" && s.publishedDate && <span className={fr.cls}>{fr.label}</span>}
                  {s.userEdited?.type && <span className="text-ink-3">Type set by you</span>}
                  {st?.status !== "failed" &&
                    (s.sourceType === "ai-answer" ? (
                      <span>
                        {n} claim{n === 1 ? "" : "s"} audited against the sources
                      </span>
                    ) : (
                      <span>
                        {n} claim{n === 1 ? "" : "s"} · {v} quote{v === 1 ? "" : "s"} verified
                      </span>
                    ))}
                </div>
                {st?.status === "failed" && (
                  <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-semibold text-contested">
                    <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0" /> Couldn&rsquo;t be analysed{st.error ? `: ${st.error}` : "."} Its topics may show as gaps.
                  </p>
                )}
                {st?.status === "no-claims" && (
                  <p className="mt-1 text-[12.5px] text-ink-3">Read, but nothing in it answered a planned topic.</p>
                )}
                {st?.excerpted && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                    <Scissors size={13} aria-hidden /> Long source: the most relevant excerpts were analysed, not every page.
                  </p>
                )}
                {s.via === "search-service" && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                    <Search size={13} aria-hidden /> The site blocked direct reading, so the search service&rsquo;s copy of the page was used.
                  </p>
                )}
                {st?.cached && <p className="mt-1 text-[12.5px] text-ink-3">Unchanged since the last run, so the earlier extraction was reused.</p>}
                {g && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-outdated-ink">
                    <Copy size={13} aria-hidden /> Shares about {Math.round(g.similarity * 100)}% of its wording with{" "}
                    {g.sourceIds
                      .filter((x) => x !== s.id)
                      .map(tagOf)
                      .join(", ")}
                    , so they count as one origin.
                  </p>
                )}
              </div>
              <button type="button" onClick={() => openSource(s.id)} className={`${btn.link} no-print`}>
                <FileText size={14} aria-hidden /> Read source
              </button>
            </li>
          );
        })}
      </ul>
      <p className="pt-1 text-[12.5px] text-ink-3">
        Independent origins: sources that copy each other&rsquo;s wording count once, so ten reposts of one article don&rsquo;t look like ten confirmations.
      </p>
    </div>
  );
}
