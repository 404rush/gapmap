"use client";

import { createContext, useContext, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { CircleHelp, Quote, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { SOURCE_TYPE_LABEL } from "@/lib/sourceType";
import type { Basis, Claim, Confidence, Importance, NodeStatus, SourceMeta } from "@/lib/types";

export const STATUS: Record<NodeStatus, { label: string; short: string; tone: string; pat: string; desc: string }> = {
  covered: { label: "Covered by sources", short: "Covered", tone: "text-covered", pat: "pat-covered", desc: "Two or more independent sources agree and nothing conflicts." },
  thin: { label: "Single source only", short: "Single source", tone: "text-thin", pat: "pat-thin", desc: "Only one independent source covers this. Worth a second check." },
  outdated: {
    label: "Possibly outdated",
    short: "Possibly outdated",
    tone: "text-outdated-ink",
    pat: "pat-outdated",
    desc: "Sources differ in a way that looks like older information, or all coverage is old or undated.",
  },
  contested: { label: "Possible conflict", short: "Possible conflict", tone: "text-contested", pat: "pat-contested", desc: "Sources make claims that can't all be right at once." },
  gap: { label: "Potential gap", short: "Potential gap", tone: "text-gap-ink", pat: "pat-gap", desc: "No reviewed source answers this." },
};

export const tagOf = (id: string) => `S${id.replace(/\D/g, "")}`;

export function StatusSwatch({ status, size = 14 }: { status: NodeStatus; size?: number }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-[3px] ${STATUS[status].pat}`} style={{ width: size, height: size }} />;
}

const BASIS: Record<Basis, { label: string; cls: string; icon: ReactNode; title: string }> = {
  sourced: {
    label: "Sourced",
    cls: "bg-ink text-white",
    icon: <Quote size={11} strokeWidth={2.5} aria-hidden />,
    title: "Backed by a quote found word-for-word on the source page.",
  },
  ai: {
    label: "AI suggestion",
    cls: "bg-[color-mix(in_srgb,var(--ai)_12%,white)] text-ai ring-1 ring-[color-mix(in_srgb,var(--ai)_40%,white)]",
    icon: <Sparkles size={11} strokeWidth={2.5} aria-hidden />,
    title: "Written by the AI from the sources. A signal to check, not a fact.",
  },
  uncertain: {
    label: "Uncertain",
    cls: "bg-white text-uncertain border border-dashed border-uncertain",
    icon: <CircleHelp size={11} strokeWidth={2.5} aria-hidden />,
    title: "Couldn't be confirmed against the page text, comes from an AI answer, or confidence is low.",
  },
};

export function BasisChip({ basis, className = "" }: { basis: Basis; className?: string }) {
  const b = BASIS[basis];
  return (
    <span title={b.title} className={`chip ${b.cls} ${className}`}>
      {b.icon}
      {b.label}
    </span>
  );
}

const IMP: Record<Importance, string> = {
  critical: "bg-contested text-white",
  important: "bg-ink text-white",
  optional: "bg-rule-soft text-ink-2",
};

export function ImportanceTag({ value }: { value: Importance }) {
  return <span className={`chip ${IMP[value]}`}>{value[0].toUpperCase() + value.slice(1)}</span>;
}

const CONF: Record<Confidence, { cls: string; bars: number }> = {
  high: { cls: "text-covered", bars: 3 },
  medium: { cls: "text-outdated-ink", bars: 2 },
  low: { cls: "text-contested", bars: 1 },
};

/** Three-bar confidence meter with a text label (never colour alone). */
export function ConfidenceTag({ value, reasons }: { value: Confidence; reasons?: string[] }) {
  const c = CONF[value];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${c.cls}`} title={reasons?.join(" ")}>
      <span aria-hidden className="inline-flex items-end gap-[2px]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-[4px] rounded-[1px] ${i <= c.bars ? "bg-current" : "bg-rule"}`} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      Confidence: {value}
    </span>
  );
}

export function TypeTag({ type }: { type: SourceMeta["sourceType"] }) {
  const ai = type === "ai-answer";
  return <span className={`chip ${ai ? "bg-[color-mix(in_srgb,var(--ai)_12%,white)] text-ai" : "bg-rule-soft text-ink-2"}`}>{SOURCE_TYPE_LABEL[type] ?? "Website"}</span>;
}

export function SampleTag() {
  return (
    <span className="chip bg-mark text-ink" title="A fictional source written for the demo. Not a real organisation.">
      Sample source
    </span>
  );
}

export function SourceDate({ s }: { s: Pick<SourceMeta, "publishedDate" | "dateLabel" | "dateEvidence" | "sourceType" | "userEdited"> }) {
  if (s.sourceType === "ai-answer") return <span className="text-ink-3">No date (AI answer)</span>;
  if (!s.publishedDate)
    return (
      <span className="font-semibold text-uncertain" title="No publish or update date was found.">
        Undated
      </span>
    );
  return (
    <span title={s.dateEvidence ? `Date found in: ${s.dateEvidence}` : undefined}>
      {s.dateLabel ?? "Dated"} {formatDate(s.publishedDate)}
      {s.userEdited?.date ? " (set by you)" : ""}
    </span>
  );
}

// ——— Evidence context: lets any component open the evidence viewer ———
export interface EvidenceApi {
  openClaim: (claimId: string) => void;
  openSource: (sourceId: string) => void;
  claimById: Map<string, Claim>;
  sourceById: Map<string, SourceMeta>;
}
export const EvidenceContext = createContext<EvidenceApi | null>(null);
export function useEvidence() {
  const ctx = useContext(EvidenceContext);
  if (!ctx) throw new Error("EvidenceContext missing");
  return ctx;
}

/** Render AI text with [s1c2, s3c1] citations turned into evidence buttons. */
export function CitedText({ text }: { text: string }) {
  const { openClaim, claimById, sourceById } = useEvidence();
  const parts = text.split(/(\[[a-z0-9,\s]+\])/gi);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([a-z0-9,\s]+)\]$/i);
        if (!m) return <span key={i}>{p}</span>;
        const ids = m[1].split(/[,\s]+/).filter((id) => claimById.has(id));
        if (!ids.length) return <span key={i}>{p}</span>;
        return (
          <span key={i} className="whitespace-nowrap">
            {ids.map((id) => {
              const c = claimById.get(id)!;
              const src = sourceById.get(c.sourceId);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => openClaim(id)}
                  aria-label={`Open the quote from source ${tagOf(c.sourceId)}${src ? `, ${src.title}` : ""}`}
                  title={`Open the quote from ${src?.title ?? "source"}`}
                  className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded bg-ink px-1.5 py-[1px] text-[11px] font-bold text-white hover:bg-ai"
                >
                  {tagOf(c.sourceId)}
                </button>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

export function SectionHead({ step, title, children, id }: { step?: number; title: string; children?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h2 id={id} className="display flex items-baseline gap-3 text-[30px] sm:text-[36px]">
        {step !== undefined && <span className="text-ink-3">{step}</span>}
        {title}
      </h2>
      {children}
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#24344a] disabled:cursor-not-allowed disabled:opacity-40",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-ink bg-sheet px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-40",
  ghost: "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-semibold text-ink-2 hover:bg-rule-soft hover:text-ink disabled:opacity-40",
  link: "inline-flex items-center gap-1 text-[13px] font-semibold text-ai hover:underline",
};

// ——— Accessible tabs: roving focus, arrow keys, Home/End ———
export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
}

export function TabList<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className = "",
  tabClass,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idBase: string;
  className?: string;
  tabClass: (active: boolean) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = tabs.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(tabs[to].id);
    refs.current[to]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={className}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`${idBase}-tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          aria-controls={`${idBase}-panel`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={tabClass(value === t.id)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idBase, active, children, className = "" }: { idBase: string; active: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${active}`} tabIndex={0} className={className}>
      {children}
    </div>
  );
}

export function useIdBase(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}
