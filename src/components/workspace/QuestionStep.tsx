"use client";

import { useRef } from "react";
import { AlertTriangle, FileJson, History, Loader2, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { SCENARIOS } from "@/lib/samples";
import { BasisChip, STATUS, StatusSwatch, btn } from "../ui";
import type { HistoryEntry, Mode } from "./session";

const EXAMPLES = [
  "What documents do I need to apply for a fresh passport in India?",
  "Can I carry a power bank on a domestic flight in India?",
  "What GST rate applies to packaged snacks now?",
];

const HOW = [
  ["Question", "You say what you need to know."],
  ["Coverage plan", "Before reading anything, GapMap lists what a complete answer should cover. You can edit it."],
  ["Sources", "Add links, PDFs or pasted text, or search the web. Paste a chatbot's answer to audit it."],
  ["Findings", "Each topic is marked covered, single-source, possibly outdated, possibly conflicting, or a potential gap, with the quotes behind it."],
  ["Verify next", "A prioritised checklist: where to check, what to search, and a ready-made question to ask."],
];

export function QuestionStep(props: {
  mode: Mode;
  scenarioId?: string;
  question: string;
  setQuestion: (q: string) => void;
  onPickScenario: (id: string) => void;
  onPlan: () => void;
  planning: boolean;
  error: string | null;
  liveBlocked: boolean;
  onSample: () => void;
  history: HistoryEntry[];
  onOpenHistory: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  onImport: (file: File) => void;
  currentId: string;
  /** A plan already exists for this exact question. */
  planReady: boolean;
}) {
  const { mode, question, setQuestion, onPlan, planning, error, liveBlocked } = props;
  const valid = question.trim().length >= 8;
  const fileRef = useRef<HTMLInputElement>(null);
  const others = props.history.filter((h) => h.id !== props.currentId);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h1 className="display max-w-[16ch] text-[44px] sm:text-[64px]" style={{ fontStretch: "70%", fontWeight: 900 }}>
          Find out what your sources don&rsquo;t tell you.
        </h1>
        <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">
          Ask a question and add the pages you&rsquo;d normally read. GapMap maps what they cover, where they disagree, what may be out of date and what none of them
          answer. Every finding links to the exact sentence it came from, and you finish with a list of what to verify next.
        </p>

        <div className="mt-8 rounded-lg border-2 border-ink bg-sheet p-4 sm:p-5">
          {mode === "sample" ? (
            <fieldset>
              <legend className="text-[14px] font-bold">Pick a sample scenario</legend>
              <p className="mt-0.5 text-[13px] text-ink-3">Fictional sources written to show every kind of finding. No API key needed.</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {SCENARIOS.map((s) => {
                  const on = props.scenarioId === s.id;
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 bg-white p-3 ${on ? "border-ink" : "border-rule hover:border-ink-3"}`}
                    >
                      <span className="flex items-center gap-2">
                        <input type="radio" name="scenario" checked={on} onChange={() => props.onPickScenario(s.id)} className="accent-[var(--ink)]" />
                        <span className="text-[14.5px] font-bold">{s.title}</span>
                      </span>
                      <span className="text-[13.5px] font-semibold leading-snug">&ldquo;{s.question}&rdquo;</span>
                      <span className="text-[12.5px] text-ink-3">{s.blurb}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <>
              <label htmlFor="q" className="text-[14px] font-bold">
                Your question or research goal
              </label>
              <textarea
                id="q"
                value={question}
                maxLength={600}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && valid && !liveBlocked) onPlan();
                }}
                rows={3}
                placeholder="e.g. What should I verify before applying for a student travel pass?"
                className="mt-2 w-full resize-y rounded-md border border-rule bg-white px-3 py-2.5 text-[17px] leading-snug outline-none focus:border-ink"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="self-center text-[12.5px] text-ink-3">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQuestion(ex)}
                    className="rounded-full border border-rule bg-white px-3 py-1 text-left text-[12.5px] text-ink-2 hover:border-ink hover:text-ink"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </>
          )}
          {liveBlocked && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-[color-mix(in_srgb,var(--contested)_10%,white)] p-2.5 text-[13.5px] text-contested">
              <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Live mode needs a free AI key. Add <code className="font-bold">GEMINI_API_KEY</code> to <code className="font-bold">.env.local</code> and restart (see the
                README), or{" "}
                <button type="button" onClick={props.onSample} className="font-bold underline">
                  try the sample demo
                </button>
                .
              </span>
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13.5px] font-semibold text-contested">
              {error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onPlan} disabled={!valid || planning || liveBlocked} className={btn.primary}>
              {planning && <Loader2 size={16} aria-hidden className="animate-spin" />}
              {planning ? "Planning what a complete answer needs…" : props.planReady ? "Continue to the plan" : "Plan what to check"}
            </button>
            {mode === "live" && (
              <button type="button" onClick={props.onSample} className={btn.secondary}>
                Try the sample demo
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[14px] font-bold">
              <History size={16} aria-hidden /> Recent analyses
            </h2>
            <button type="button" onClick={() => fileRef.current?.click()} className={btn.ghost}>
              <FileJson size={15} aria-hidden /> Open a saved analysis (.json)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Open a saved analysis"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onImport(f);
                e.target.value = "";
              }}
            />
          </div>
          {others.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-3">Analyses you run are saved in this browser only, so you can come back to them.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {others.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-md border border-rule bg-sheet px-3 py-2">
                  <button type="button" onClick={() => props.onOpenHistory(h.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[14px] font-semibold">{h.question}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                      {formatDateTime(h.savedAt)} · {h.mode === "sample" ? "Sample" : "Live"} · {h.sources} source{h.sources === 1 ? "" : "s"}
                      {h.counts ? (
                        <span className="flex items-center gap-1.5">
                          {(Object.keys(STATUS) as (keyof typeof STATUS)[])
                            .filter((k) => h.counts?.[k])
                            .map((k) => (
                              <span key={k} className="flex items-center gap-0.5" title={STATUS[k].label}>
                                <StatusSwatch status={k} size={10} />
                                {h.counts![k]}
                              </span>
                            ))}
                        </span>
                      ) : (
                        <span>· Draft</span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDeleteHistory(h.id)}
                    className="rounded p-1.5 text-ink-3 hover:bg-rule-soft hover:text-contested"
                    aria-label={`Delete "${h.question}" from recent analyses`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="self-start rounded-lg border border-rule bg-sheet p-5">
        <h2 className="text-[14px] font-bold">How it works</h2>
        <ol className="mt-3 space-y-3 text-[14px]">
          {HOW.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="display w-5 shrink-0 text-[20px] text-ink-3">{i + 1}</span>
              <span>
                <span className="font-semibold">{t}.</span> <span className="text-ink-2">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 border-t border-rule pt-4">
          <p className="mb-2 text-[12.5px] font-bold text-ink-3">Every item is labelled</p>
          <div className="flex flex-wrap gap-2">
            <BasisChip basis="sourced" />
            <BasisChip basis="ai" />
            <BasisChip basis="uncertain" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
            {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <StatusSwatch status={s} />
                {STATUS[s].short}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
