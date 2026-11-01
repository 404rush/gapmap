"use client";

import { useState } from "react";
import { Check, Copy, Download, MessageSquareText, NotebookPen, Plus, Printer, Search } from "lucide-react";
import { checkKey, type CheckState, type Checks } from "@/lib/checks";
import { buildReport } from "@/lib/report";
import type { Analysis, Importance } from "@/lib/types";
import { BasisChip, btn } from "./ui";

const GROUPS: { id: Importance; label: string; note: string }[] = [
  { id: "critical", label: "Critical", note: "Acting without these could mean a rejected application, a missed deadline or a wrong decision." },
  { id: "important", label: "Important", note: "Worth confirming before you rely on the answer." },
  { id: "optional", label: "Good to check", note: "Lower stakes, but still unconfirmed." },
];

const ORIGIN_LABEL: Record<string, string> = {
  gap: "A potential gap",
  conflict: "A possible conflict",
  outdated: "Possibly outdated information",
  "open-question": "An unanswered question",
  "single-source": "Single-source coverage",
  general: "General check",
};

interface Props {
  a: Analysis;
  checks: Checks;
  setCheck: (key: string, value: CheckState) => void;
  onFindSource?: (topicId: string) => void;
  onJumpToNode?: (topicId: string) => void;
  onPrint?: () => void;
}

export function Checklist({ a, checks, setCheck, onFindSource, onJumpToNode, onPrint }: Props) {
  const [openAsk, setOpenAsk] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the text is still on screen to copy by hand */
    }
  };

  const download = () => {
    const blob = new Blob([buildReport(a, checks)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `gapmap-report-${a.generatedAt.slice(0, 10)}.md`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const doneCount = a.checklist.filter((c) => checks[checkKey(c)]?.done).length;
  const topicName = (id: string) => {
    const i = a.subQuestions.findIndex((q) => q.id === id);
    return i < 0 ? undefined : `Topic ${i + 1}`;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BasisChip basis="ai" />
        <p className="min-w-0 flex-1 basis-[280px] text-[13.5px] text-ink-2">
          Suggested by the AI from the findings above, then checked by GapMap&rsquo;s rules so every gap, conflict and critical single-source topic has a step.
        </p>
        <span className="text-[13.5px] font-semibold" aria-live="polite">
          {doneCount} of {a.checklist.length} verified
        </span>
      </div>
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-rule-soft" aria-hidden>
        <div className="h-full bg-covered transition-[width]" style={{ width: `${a.checklist.length ? (doneCount / a.checklist.length) * 100 : 0}%` }} />
      </div>

      {!a.checklist.length && <p className="py-6 text-center text-[14px] text-ink-3">Nothing to verify — every topic is covered by independent, dated sources.</p>}

      <div className="space-y-6">
        {GROUPS.map((g) => {
          const items = a.checklist.filter((c) => c.priority === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id}>
              <h3 className="display text-[22px]" style={{ fontStretch: "80%" }}>
                <span className={g.id === "critical" ? "text-contested" : ""}>{g.label}</span>{" "}
                <span className="text-[15px] font-semibold text-ink-3">({items.length})</span>
              </h3>
              <p className="mb-2 text-[13px] text-ink-3">{g.note}</p>
              <ol className="space-y-2.5">
                {items.map((c) => {
                  const key = checkKey(c);
                  const st = checks[key] ?? { done: false };
                  const topic = c.topicIds[0];
                  return (
                    <li key={c.id} className={`rounded-md border bg-white p-3.5 ${st.done ? "border-covered/50" : "border-rule"}`}>
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={st.done}
                          aria-label={`Mark "${c.task}" as verified`}
                          onClick={() => setCheck(key, { ...st, done: !st.done })}
                          className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border-2 ${
                            st.done ? "border-covered bg-covered text-white" : "border-ink bg-white"
                          }`}
                        >
                          {st.done && <Check size={15} strokeWidth={3} aria-hidden />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`text-[15px] font-semibold leading-snug ${st.done ? "text-ink-3 line-through" : ""}`}>{c.task}</p>
                            {c.tag === "new" && <span className="chip bg-[color-mix(in_srgb,var(--ai)_12%,white)] text-ai">New since last run</span>}
                            {c.tag === "still-open" && <span className="chip bg-rule-soft text-ink-2">Still open</span>}
                          </div>
                          <p className="mt-1 text-[13.5px] text-ink-2">{c.why}</p>
                          <dl className="mt-2 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
                            <dt className="font-bold">Where to verify</dt>
                            <dd>{c.whereToVerify}</dd>
                            <dt className="font-bold">Comes from</dt>
                            <dd className="text-ink-2">
                              {ORIGIN_LABEL[c.origin] ?? c.origin}
                              {c.topicIds.length > 0 && (
                                <>
                                  {" "}
                                  in{" "}
                                  {c.topicIds.map((t, i) => (
                                    <span key={t}>
                                      {i > 0 && ", "}
                                      {onJumpToNode ? (
                                        <button type="button" onClick={() => onJumpToNode(t)} className="font-semibold text-ai hover:underline">
                                          {topicName(t)}
                                        </button>
                                      ) : (
                                        topicName(t)
                                      )}
                                    </span>
                                  ))}
                                </>
                              )}
                            </dd>
                            {st.note && (
                              <>
                                <dt className="font-bold">Your note</dt>
                                <dd className="whitespace-pre-wrap">{st.note}</dd>
                              </>
                            )}
                          </dl>
                          <div className="no-print mt-2.5 flex flex-wrap gap-2">
                            <a
                              className={`${btn.ghost} border border-rule`}
                              href={`https://www.google.com/search?q=${encodeURIComponent(c.searchQuery)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Search size={14} aria-hidden /> <span className="max-w-[260px] truncate">Search: {c.searchQuery}</span>
                            </a>
                            {onFindSource && topic && (
                              <button type="button" className={`${btn.ghost} border border-rule`} onClick={() => onFindSource(topic)}>
                                <Plus size={14} aria-hidden /> Add a source and re-run
                              </button>
                            )}
                            {c.askSource && (
                              <button
                                type="button"
                                className={`${btn.ghost} border border-rule`}
                                onClick={() => setOpenAsk(openAsk === c.id ? null : c.id)}
                                aria-expanded={openAsk === c.id}
                              >
                                <MessageSquareText size={14} aria-hidden /> Draft a question to the source
                              </button>
                            )}
                            <button
                              type="button"
                              className={`${btn.ghost} border border-rule`}
                              onClick={() => setOpenNote(openNote === c.id ? null : c.id)}
                              aria-expanded={openNote === c.id}
                            >
                              <NotebookPen size={14} aria-hidden /> {st.note ? "Edit note" : "Add a note"}
                            </button>
                          </div>
                          {openAsk === c.id && c.askSource && (
                            <div className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--ai)_30%,white)] bg-[color-mix(in_srgb,var(--ai)_5%,white)] p-3">
                              <p className="serif text-[15px] leading-relaxed">{c.askSource}</p>
                              <button type="button" onClick={() => copy(c.id, c.askSource!)} className={`${btn.link} mt-2`}>
                                <Copy size={13} aria-hidden /> {copied === c.id ? "Copied" : "Copy message"}
                              </button>
                            </div>
                          )}
                          {openNote === c.id && (
                            <NoteEditor
                              initial={st.note ?? ""}
                              onSave={(note) => {
                                setCheck(key, { ...st, note: note.trim() || undefined });
                                setOpenNote(null);
                              }}
                              onCancel={() => setOpenNote(null)}
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="no-print mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={download} className={btn.primary}>
          <Download size={16} aria-hidden /> Download report (.md)
        </button>
        <button type="button" onClick={onPrint ?? (() => window.print())} className={btn.secondary}>
          <Printer size={16} aria-hidden /> Print or save as PDF
        </button>
      </div>
    </div>
  );
}

function NoteEditor({ initial, onSave, onCancel }: { initial: string; onSave: (s: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <div className="mt-2">
      <label className="text-[12.5px] font-bold" htmlFor="note-editor">
        What you found (saved with this analysis and included in the report)
      </label>
      <textarea
        id="note-editor"
        autoFocus
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-ink bg-white p-2 text-[14px]"
        placeholder="e.g. Called the helpline on 3 Nov — they confirmed the 30 November deadline."
      />
      <div className="mt-1.5 flex gap-2">
        <button type="button" className={btn.primary} onClick={() => onSave(text)}>
          Save note
        </button>
        <button type="button" className={btn.ghost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
