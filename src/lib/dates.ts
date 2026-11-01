// Date and cycle detection. Pure functions, safe in browser and server.

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Build yyyy-mm-dd, rejecting impossible dates such as 31 February. */
function iso(y: number, m: number, d: number): string | undefined {
  if (y < 1990 || y > 2100 || m < 0 || m > 11 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return undefined;
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

const month = (s: string) => MONTHS[s.toLowerCase().replace(/\.$/, "")];

/** Parse many common date spellings into yyyy-mm-dd. */
export function parseLooseDate(raw: string): string | undefined {
  const s = raw.trim();
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s.\-/]+([A-Za-z]{3,9})\.?[,\s.\-/]+(\d{4})\b/);
  if (m && month(m[2]) !== undefined) return iso(+m[3], month(m[2]), +m[1]);
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && month(m[1]) !== undefined) return iso(+m[3], month(m[1]), +m[2]);
  // Numeric dates: day-first (Indian convention) unless only month-first makes sense.
  m = s.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    if (b > 12 && a <= 12) return iso(+m[3], a - 1, b);
    return iso(+m[3], b - 1, a);
  }
  m = s.match(/\b([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (m && month(m[1]) !== undefined) return iso(+m[2], month(m[1]), 1);
  return undefined;
}

/** A publish/update date must not be in the future (allowing for time zones). */
export function isPlausiblePublishDate(isoDate: string | undefined, now: Date = new Date()): boolean {
  if (!isoDate) return false;
  const t = new Date(isoDate + "T00:00:00Z").getTime();
  return t >= Date.UTC(1995, 0, 1) && t <= now.getTime() + 2 * 86_400_000;
}

const DATE_VALUE =
  "((?:\\d{1,2}(?:st|nd|rd|th)?[\\s.\\-/]+[A-Za-z]{3,9}\\.?[,\\s.\\-/]+\\d{4})|(?:[A-Za-z]{3,9}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})|(?:\\d{4}-\\d{1,2}-\\d{1,2})|(?:\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}))";
const DATE_LABEL =
  "(last\\s+updated|last\\s+modified|last\\s+reviewed|updated\\s+on|updated|modified\\s+on|published\\s+on|published|posted\\s+on|posted|issued\\s+on|issued|release\\s+date|date\\s+of\\s+(?:issue|publication)|dated|date)";
const DATE_PHRASE = new RegExp(`\\b${DATE_LABEL}\\b\\s*(?:on\\s+)?[:\\-–]?\\s*${DATE_VALUE}`, "gi");

/** Words that turn a bare "date" into an event date (a deadline, an exam) rather than the page's own date. */
const EVENT_DATE_PREFIX =
  /\b(last|closing|close|due|deadline|final|exam|examination|test|birth|expiry|end|ending|start|starting|opening|application|submission|result|interview|joining|commencement|counselling|counseling|admit\s+card|reporting|payment|registration|effective|event|launch)\s*$/i;

export interface FoundDate {
  date: string;
  label: string;
  evidence: string;
}

function labelFor(word: string): string {
  if (/update|modified|reviewed/i.test(word)) return "Last updated";
  if (/publish|posted|release/i.test(word)) return "Published";
  return "Dated";
}

/**
 * Look for "Last updated: 12 Aug 2026" style phrases near the top or bottom of
 * the text. Ignores deadlines and event dates ("Last date: …", "Exam date: …")
 * and anything in the future. Prefers an "updated" date over a "published" one.
 */
export function findDateInText(text: string, now: Date = new Date()): FoundDate | undefined {
  const chunks = [text.slice(0, 4000), text.length > 4000 ? text.slice(-2500) : ""];
  const found: FoundDate[] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    DATE_PHRASE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DATE_PHRASE.exec(chunk))) {
      const word = m[1];
      if (/^date$/i.test(word.trim())) {
        const before = chunk.slice(Math.max(0, m.index - 40), m.index);
        if (EVENT_DATE_PREFIX.test(before)) continue;
      }
      const date = parseLooseDate(m[2]);
      if (!date || !isPlausiblePublishDate(date, now)) continue;
      found.push({ date, label: labelFor(word), evidence: `Text on page: "${m[0].trim().slice(0, 60)}"` });
    }
    if (found.length) break;
  }
  return found.find((f) => f.label === "Last updated") ?? found[0];
}

/** Academic / financial cycle mentions such as 2024-25, FY 2025-26, 2023–2024. */
export function findCycleMentions(text: string): string[] {
  const found = new Set<string>();
  const re = /\b(?:FY\s*|AY\s*|session\s*)?(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = +m[1];
    const endRaw = m[2];
    const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + +endRaw : +endRaw;
    if (end === start + 1) found.add(`${start}-${String(end).slice(2)}`);
  }
  return [...found].sort();
}

/** End year of a cycle string "2024-25" -> 2025 */
export function cycleEndYear(cycle: string): number {
  const [a, b] = cycle.split("-");
  return Math.floor(+a / 100) * 100 + +b;
}

/**
 * Academic sessions usually run to June/July and financial years to March, so
 * a cycle ending in year Y is treated as over from 1 July of Y.
 */
export function cycleEndDate(cycle: string): string {
  return `${cycleEndYear(cycle)}-07-01`;
}

export function cycleEnded(cycle: string, now: Date): boolean {
  return new Date(cycleEndDate(cycle) + "T00:00:00Z").getTime() <= now.getTime();
}

export function monthsBetween(fromIso: string, to: Date): number {
  const d = new Date(fromIso + "T00:00:00Z");
  return (to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

export function formatDate(isoDate?: string): string {
  if (!isoDate) return "Undated";
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(isoTime: string): string {
  return new Date(isoTime).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function describeAge(isoDate: string | undefined, now: Date): string {
  if (!isoDate) return "No date found";
  const months = monthsBetween(isoDate, now);
  if (months < 0) return "Future date";
  if (months < 1) return "Less than a month old";
  if (months < 12) return `${Math.round(months)} month${Math.round(months) === 1 ? "" : "s"} old`;
  const years = months / 12;
  return `${years < 2 ? years.toFixed(1) : Math.round(years)} years old`;
}

/** Parse a PDF info date such as "D:20260812093000+05'30'". */
export function parsePdfDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = String(raw).match(/(?:D:)?(\d{4})(\d{2})(\d{2})/);
  return m ? iso(+m[1], +m[2] - 1, +m[3]) : undefined;
}
