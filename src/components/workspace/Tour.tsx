"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { btn } from "../ui";

export interface TourStep {
  /** id of the element to point at */
  target: string;
  title: string;
  body: string;
  /** e.g. open a map node or switch a tab before pointing at it */
  prepare?: () => void;
}

/** A short guided walk through the results. Non-modal: the page stays usable. */
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = steps[i];

  useEffect(() => {
    if (!step) return;
    step.prepare?.();
    let el: HTMLElement | null = null;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el = document.getElementById(step.target);
        el?.classList.add("tour-focus");
        el?.scrollIntoView({ behavior: "smooth", block: el.offsetHeight > window.innerHeight * 0.6 ? "start" : "center" });
      }),
    );
    return () => {
      cancelAnimationFrame(raf);
      el?.classList.remove("tour-focus");
    };
    // step objects are rebuilt on each render; the index is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;
  const last = i === steps.length - 1;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      aria-live="polite"
      className="no-print fixed inset-x-3 bottom-3 z-[45] mx-auto max-w-[440px] rounded-lg border-2 border-ink bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-bold text-ai">
          Guided tour · {i + 1} of {steps.length}
        </p>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded p-1 text-ink-3 hover:bg-rule-soft" aria-label="End the tour">
          <X size={16} aria-hidden />
        </button>
      </div>
      <h2 id="tour-title" className="mt-1 text-[16px] font-bold leading-snug">
        {step.title}
      </h2>
      <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{step.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className={btn.ghost} onClick={() => setI(i - 1)} disabled={i === 0}>
          Back
        </button>
        <button type="button" className={`${btn.primary} ml-auto !py-1.5`} onClick={() => (last ? onClose() : setI(i + 1))} autoFocus>
          {last ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
