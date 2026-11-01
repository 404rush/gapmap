"use client";

import { Lock, Plus, Trash2 } from "lucide-react";
import { LIMITS } from "@/lib/validate";
import type { Importance, SubQuestion, Volatility } from "@/lib/types";
import { BasisChip, ImportanceTag, SectionHead, btn } from "../ui";
import type { Mode } from "./session";

const VOL_LABEL: Record<Volatility, string> = {
  fast: "Changes yearly or faster",
  medium: "Changes every 1–2 years",
  slow: "Rarely changes",
};

export function PlanStep(props: {
  mode: Mode;
  question: string;
  subQuestions: SubQuestion[];
  setSubQuestions: (q: SubQuestion[]) => void;
  hasAnalysis: boolean;
  model?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const { subQuestions, setSubQuestions, mode } = props;
  const locked = mode === "sample";
  const update = (id: string, patch: Partial<SubQuestion>) => setSubQuestions(subQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const remove = (id: string) => setSubQuestions(subQuestions.filter((q) => q.id !== id));
  const add = () => {
    const n = Math.max(0, ...subQuestions.map((q) => Number(q.id.replace(/\D/g, "")) || 0)) + 1;
    setSubQuestions([...subQuestions, { id: `q${n}`, text: "", importance: "important", volatility: "medium", why: "Added by you." }]);
  };
  const filled = subQuestions.filter((q) => q.text.trim()).length;
  const full = subQuestions.length >= LIMITS.topics;

  return (
    <section>
      <SectionHead step={2} title="Coverage plan">
        <span className="flex items-center gap-2">
          <BasisChip basis="ai" />
          {props.model && <span className="text-[12px] text-ink-3">{props.model}</span>}
        </span>
      </SectionHead>
      <p className="max-w-[70ch] text-[15px] text-ink-2">
        Before reading any source, GapMap lists what a complete answer to <span className="font-semibold text-ink">&ldquo;{props.question}&rdquo;</span> should cover.
        Anything the sources leave empty becomes a potential gap. <span className="font-semibold">How fast it changes</span> sets how old a source can be before
        it&rsquo;s flagged.
      </p>
      {locked ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-rule bg-sheet p-2.5 text-[13px] text-ink-2">
          <Lock size={15} aria-hidden className="mt-0.5 shrink-0" />
          The sample&rsquo;s plan is fixed so it matches its saved AI outputs. In live mode you can edit, add or remove topics.
        </p>
      ) : (
        props.hasAnalysis && (
          <p className="mt-3 rounded-md border border-outdated bg-[color-mix(in_srgb,var(--outdated)_8%,white)] p-2.5 text-[13px]">
            Changing the plan means re-running the analysis. Sources you&rsquo;ve added stay.
          </p>
        )
      )}
      <ul className="mt-5 space-y-2.5">
        {subQuestions.map((q, i) => (
          <li key={q.id} className="rounded-md border border-rule bg-sheet p-3">
            {locked ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="display w-6 text-[20px] text-ink-3">{i + 1}</span>
                <span className="min-w-[220px] flex-1 text-[15.5px] font-semibold">{q.text}</span>
                <ImportanceTag value={q.importance} />
                <span className="text-[12.5px] text-ink-3">{VOL_LABEL[q.volatility]}</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="display w-6 text-[20px] text-ink-3">{i + 1}</span>
                <input
                  value={q.text}
                  maxLength={200}
                  onChange={(e) => update(q.id, { text: e.target.value })}
                  aria-label={`Topic ${i + 1}`}
                  placeholder="Write a topic as a question"
                  className="min-w-[220px] flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-[15.5px] font-semibold hover:border-rule focus:border-ink focus:bg-white focus:outline-none"
                />
                <select
                  value={q.importance}
                  onChange={(e) => update(q.id, { importance: e.target.value as Importance })}
                  aria-label={`Importance of topic ${i + 1}`}
                  className="rounded border border-rule bg-white px-2 py-1 text-[13px]"
                >
                  <option value="critical">Critical</option>
                  <option value="important">Important</option>
                  <option value="optional">Optional</option>
                </select>
                <select
                  value={q.volatility}
                  onChange={(e) => update(q.id, { volatility: e.target.value as Volatility })}
                  aria-label={`How fast topic ${i + 1} changes`}
                  className="rounded border border-rule bg-white px-2 py-1 text-[13px]"
                >
                  {(Object.keys(VOL_LABEL) as Volatility[]).map((v) => (
                    <option key={v} value={v}>
                      {VOL_LABEL[v]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(q.id)}
                  aria-label={`Remove topic ${i + 1}`}
                  className="rounded p-1.5 text-ink-3 hover:bg-rule-soft hover:text-contested"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            )}
            {q.why && <p className="ml-9 mt-1 text-[13px] text-ink-3">{q.why}</p>}
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={add} disabled={full} className={`${btn.ghost} border border-dashed border-ink-3`}>
            <Plus size={15} aria-hidden /> Add a topic
          </button>
          {full && <span className="text-[12.5px] text-ink-3">Up to {LIMITS.topics} topics.</span>}
        </div>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={props.onBack} className={btn.secondary}>
          Back
        </button>
        <button type="button" onClick={props.onNext} disabled={filled < 2} className={btn.primary}>
          Continue to sources
        </button>
        {filled < 2 && <span className="text-[13px] text-ink-3">Keep at least two topics.</span>}
        {!locked && filled < subQuestions.length && filled >= 2 && <span className="text-[13px] text-ink-3">Empty topics will be left out.</span>}
      </div>
    </section>
  );
}
