import { ImageResponse } from "next/og";

export const alt = "GapMap — a knowledge map of what your sources cover, contradict, leave outdated or never answer.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS: [string, string, string][] = [
  ["#1e6b52", "Covered by sources", "solid"],
  ["#2f6fad", "Single source only", "solid"],
  ["#a87400", "Possibly outdated", "solid"],
  ["#b3261e", "Possible conflict", "solid"],
  ["#6f7c89", "Potential gap", "dashed"],
];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#eaeef1", color: "#172230", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", width: 64, height: 64, gap: 6 }}>
              <div style={{ width: 29, height: 29, background: "#1e6b52", borderRadius: 4 }} />
              <div style={{ width: 29, height: 29, border: "4px dashed #6f7c89", borderRadius: 4 }} />
              <div style={{ width: 29, height: 29, background: "#b3261e", borderRadius: 4 }} />
              <div style={{ width: 29, height: 29, background: "#a87400", borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>GapMap</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 600 }}>Find out what your sources don&rsquo;t tell you.</div>
            <div style={{ fontSize: 26, color: "#3a4756", maxWidth: 600, lineHeight: 1.35 }}>
              Gaps, conflicts, outdated details and unanswered questions — every finding linked to the exact sentence it came from.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, width: 420, paddingLeft: 32, borderLeft: "4px solid #172230" }}>
          {ROWS.map(([color, label, style]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 16, background: style === "dashed" ? "transparent" : "#fbfcfc", border: style === "dashed" ? `3px dashed ${color}` : "2px solid #c7d0d8", borderRadius: 8, height: 70, paddingRight: 16 }}>
              <div style={{ width: 18, height: "100%", background: style === "dashed" ? "transparent" : color, borderRadius: "6px 0 0 6px" }} />
              <div style={{ fontSize: 26, fontWeight: 700, color }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
