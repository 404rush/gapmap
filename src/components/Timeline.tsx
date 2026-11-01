"use client";

import { THRESHOLDS } from "@/lib/assemble";
import { formatDate } from "@/lib/dates";
import type { Analysis, Freshness } from "@/lib/types";
import { tagOf, useEvidence } from "./ui";

const DAY = 86_400_000;
const FILL: Record<Freshness, string> = { fresh: "var(--covered)", "check-soon": "var(--outdated)", outdated: "var(--contested)", undated: "var(--gap)" };
const LABEL: Record<Freshness, string> = { fresh: "fresh", "check-soon": "check soon", outdated: "possibly outdated", undated: "undated" };

/** Sources placed on a date line, with the age limits for fast- and medium-changing facts shaded. */
export function SourceTimeline({ a }: { a: Analysis }) {
  const { openSource } = useEvidence();
  const now = new Date(a.generatedAt).getTime();
  const sources = a.sources.filter((s) => s.sourceType !== "ai-answer");
  const dated = sources.filter((s) => s.publishedDate);
  const undated = sources.filter((s) => !s.publishedDate);
  if (!sources.length) return null;

  const times = dated.map((s) => new Date(s.publishedDate + "T00:00:00Z").getTime());
  const start = Math.min(now - 26 * 30.44 * DAY, ...times) - 20 * DAY;
  const end = now + 25 * DAY;
  const W = 1000;
  const PAD = 24;
  const x = (t: number) => PAD + ((t - start) / (end - start)) * (W - PAD * 2);
  const fastCut = now - THRESHOLDS.fast[1] * 30.44 * DAY;
  const medCut = now - THRESHOLDS.medium[1] * 30.44 * DAY;

  // Stack dots that would overlap.
  const placed: { id: string; cx: number; lane: number }[] = [];
  for (const s of [...dated].sort((p, q) => (p.publishedDate! < q.publishedDate! ? -1 : 1))) {
    const cx = x(new Date(s.publishedDate + "T00:00:00Z").getTime());
    let lane = 0;
    while (placed.some((p) => p.lane === lane && Math.abs(p.cx - cx) < 34)) lane++;
    placed.push({ id: s.id, cx, lane });
  }
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));
  const axisY = 30 + lanes * 34;
  const H = axisY + 38;
  const years: number[] = [];
  for (let y = new Date(start).getUTCFullYear() + 1; Date.UTC(y, 0, 1) < end; y++) years.push(y);
  const summary = dated.map((s) => `${tagOf(s.id)} ${formatDate(s.publishedDate)} (${LABEL[a.freshnessBySource[s.id]]})`).join(", ");

  return (
    <figure className="rounded-md border border-rule bg-white p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold">Source dates</span>
        <span className="text-[12px] text-ink-3">Shaded: older than fast-changing facts (rates, deadlines) usually stay reliable ({THRESHOLDS.fast[1]} months), and older than rules and processes do ({THRESHOLDS.medium[1]} months).</span>
      </figcaption>
      <div className="-mx-1 overflow-x-auto px-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[640px]" role="img" aria-label={`Timeline of source dates: ${summary || "none dated"}.`}>
        <defs>
          <pattern id="tl-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="color-mix(in srgb, var(--outdated) 8%, white)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="color-mix(in srgb, var(--outdated) 30%, white)" strokeWidth="3" />
          </pattern>
        </defs>
        {fastCut > start && <rect x={PAD} y={8} width={Math.max(0, x(fastCut) - PAD)} height={axisY - 8} fill="color-mix(in srgb, var(--outdated) 7%, white)" />}
        {medCut > start && <rect x={PAD} y={8} width={Math.max(0, x(medCut) - PAD)} height={axisY - 8} fill="url(#tl-hatch)" />}
        {fastCut > start && (
          <text x={x(fastCut) + 4} y={20} fontSize="12" fill="var(--outdated-ink)">
            {THRESHOLDS.fast[1]} months ago
          </text>
        )}
        {medCut > start && (
          <text x={x(medCut) + 4} y={20} fontSize="12" fill="var(--outdated-ink)">
            {THRESHOLDS.medium[1]} months ago
          </text>
        )}
        <line x1={PAD} x2={W - PAD} y1={axisY} y2={axisY} stroke="var(--ink)" strokeWidth="2" />
        {years.map((y) => {
          const tx = x(Date.UTC(y, 0, 1));
          return (
            <g key={y}>
              <line x1={tx} x2={tx} y1={axisY} y2={axisY + 6} stroke="var(--ink)" strokeWidth="1.5" />
              <text x={tx} y={axisY + 22} fontSize="13" textAnchor="middle" fill="var(--ink-2)">
                {y}
              </text>
            </g>
          );
        })}
        <line x1={x(now)} x2={x(now)} y1={8} y2={axisY + 6} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={x(now) - 4} y={axisY + 22} fontSize="13" textAnchor="end" fontWeight="700" fill="var(--ink)">
          Today
        </text>
        {placed.map((p) => {
          const s = dated.find((d) => d.id === p.id)!;
          const f = a.freshnessBySource[s.id];
          const cy = axisY - 20 - p.lane * 34;
          return (
            <g
              key={p.id}
              className="timeline-dot cursor-pointer"
              style={{ transformOrigin: `${p.cx}px ${cy}px` }}
              role="button"
              tabIndex={0}
              aria-label={`${tagOf(s.id)}, ${s.title}, ${formatDate(s.publishedDate)}, ${LABEL[f]}. Open source.`}
              onClick={() => openSource(s.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openSource(s.id))}
            >
              <line x1={p.cx} x2={p.cx} y1={cy + 13} y2={axisY} stroke={FILL[f]} strokeWidth="2" />
              <circle cx={p.cx} cy={cy} r="14" fill={FILL[f]} />
              <text x={p.cx} y={cy + 4.5} fontSize="12" fontWeight="700" textAnchor="middle" fill="#fff">
                {tagOf(s.id)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        {(["fresh", "check-soon", "outdated"] as Freshness[]).map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: FILL[f] }} />
            {LABEL[f][0].toUpperCase() + LABEL[f].slice(1)}
          </li>
        ))}
        {undated.length > 0 && (
          <li className="font-semibold text-uncertain">
            Undated (can&rsquo;t be placed): {undated.map((s) => tagOf(s.id)).join(", ")}
          </li>
        )}
      </ul>
    </figure>
  );
}
