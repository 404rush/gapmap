"use client";

import { useEffect, useRef } from "react";
import type { Mode, Step } from "./session";

export interface Health {
  ai: string | null;
  search: boolean;
}

const STEPS = ["Question", "Coverage plan", "Sources", "Findings", "Verify next"];

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      <rect x="1" y="1" width="11" height="11" rx="1.5" fill="var(--covered)" />
      <rect x="14" y="1" width="11" height="11" rx="1.5" fill="none" stroke="var(--gap)" strokeWidth="2" strokeDasharray="3 2" />
      <rect x="1" y="14" width="11" height="11" rx="1.5" fill="var(--contested)" />
      <rect x="14" y="14" width="11" height="11" rx="1.5" fill="var(--outdated)" />
    </svg>
  );
}

export function Header(props: {
  mode: Mode;
  health: Health | null;
  step: Step;
  hasPlan: boolean;
  hasAnalysis: boolean;
  /** Section 5 lives on the results page; scroll to it. */
  onStep: (s: Step, anchor?: string) => void;
  onNew: () => void;
  onMode: (m: Mode) => void;
}) {
  const { mode, health, step, hasPlan, hasAnalysis, onStep } = props;
  const reachable = (i: number) => i === 0 || (i <= 2 && hasPlan) || (i >= 3 && hasAnalysis);
  const current = step - 1;
  const navRef = useRef<HTMLElement>(null);
  // On narrow screens the stepper scrolls sideways: keep the current step visible.
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>("[aria-current=step]");
    if (nav && el && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: nav.scrollLeft + el.getBoundingClientRect().left - nav.getBoundingClientRect().left - 16, behavior: "smooth" });
  }, [step]);
  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink bg-sheet/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <button type="button" onClick={props.onNew} className="flex items-center gap-2" title="Start a new analysis (the current one stays in Recent)">
          <Logo />
          <span className="display text-[24px]" style={{ fontStretch: "75%", fontWeight: 900 }}>
            GapMap
          </span>
        </button>
        <nav ref={navRef} aria-label="Steps" className="order-3 -mx-1 w-full overflow-x-auto px-1 lg:order-none lg:w-auto lg:flex-1">
          <ol className="flex items-center gap-1 text-[13px]">
            {STEPS.map((label, i) => {
              const active = i === current || (step === 4 && i === 4);
              const can = reachable(i);
              return (
                <li key={label} className="flex items-center">
                  <button
                    type="button"
                    disabled={!can}
                    onClick={() => (i <= 2 ? onStep((i + 1) as Step) : onStep(4, i === 4 ? "verify-next" : "findings-top"))}
                    aria-current={i === current ? "step" : undefined}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold ${
                      active ? "bg-ink text-white" : can ? "text-ink hover:bg-rule-soft" : "text-ink-3"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${active ? "bg-white text-ink" : "border border-current"}`}>{i + 1}</span>
                    {label}
                  </button>
                  {i < STEPS.length - 1 && <span aria-hidden className="mx-0.5 h-px w-3 bg-rule" />}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="ml-auto flex items-center gap-2 text-[12.5px]">
          <div className="flex rounded-full border border-ink p-0.5" role="group" aria-label="Data mode">
            {(
              [
                ["live", "Live sources"],
                ["sample", "Sample demo"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => props.onMode(m)}
                className={`rounded-full px-2.5 py-1 font-semibold ${mode === m ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}
                aria-pressed={mode === m}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "live" && health && (
            <span className={`hidden items-center gap-1 sm:flex ${health.ai ? "text-covered" : "text-contested"}`} title={health.ai ?? "No AI key configured"}>
              <span aria-hidden className={`h-2 w-2 rounded-full ${health.ai ? "bg-covered" : "bg-contested"}`} />
              {health.ai ? "AI connected" : "AI not set up"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
