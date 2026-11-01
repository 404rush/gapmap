// Fetch a web page or PDF and turn it into a clean Source: readable text with
// paragraph breaks, title, site name, publish/update date (and where it was
// found). Guards: public addresses only (every redirect re-checked), size
// limit while streaming, content-type check, page charset, robots.txt.

import { lookup } from "node:dns/promises";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { findCycleMentions, findDateInText, isPlausiblePublishDate, parseLooseDate, parsePdfDate, type FoundDate } from "../dates";
import { classifySource, hostOf } from "../sourceType";
import type { Source } from "../types";

const MAX_BYTES = 6 * 1024 * 1024;
export const MAX_TEXT = 60_000;
const UA = "Mozilla/5.0 (compatible; GapMapBot/1.0; research verification tool)";
const ROBOTS_UA = "gapmapbot";

export class FetchError extends Error {
  constructor(message: string, public status = 422, public code: "blocked" | "robots" | "network" | "http" | "content" | "input" = "http") {
    super(message);
  }
}

// Address safety

export function isPrivateIp(ip: string): boolean {
  let addr = ip.toLowerCase();
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) addr = mapped[1];
  if (addr.includes(":")) {
    return addr === "::1" || addr === "::" || /^f[cd]/.test(addr) || /^fe[89ab]/.test(addr) || addr.startsWith("64:ff9b:") || addr.startsWith("2001:db8");
  }
  const [a, b] = addr.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function assertPublic(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) throw new FetchError("Only http and https links can be added.", 422, "input");
  if (url.username || url.password) throw new FetchError("Links with a username or password can't be added.", 422, "input");
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
  } catch {
    throw new FetchError(`Couldn't find the website "${url.hostname}". Check the link.`, 422, "network");
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new FetchError("Links to private or local network addresses are blocked.", 422, "blocked");
}

/** fetch() with redirects followed by hand so every hop is checked. */
async function safeFetch(url: URL, timeoutMs: number): Promise<{ res: Response; finalUrl: URL }> {
  let current = url;
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(current);
    let res: Response;
    try {
      res = await fetch(current, {
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,text/plain;q=0.8,*/*;q=0.5", "accept-language": "en-IN,en;q=0.9" },
        redirect: "manual",
        signal,
      });
    } catch {
      throw new FetchError("The site didn't respond in time or refused the connection.", 422, "network");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current);
      continue;
    }
    return { res, finalUrl: current };
  }
  throw new FetchError("The link redirects too many times.", 422, "http");
}

async function readLimited(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max) throw new FetchError("That file is too large to analyse (limit 6 MB).", 413, "content");
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new FetchError("That file is too large to analyse (limit 6 MB).", 413, "content");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** Decode using the charset from the header, or from a <meta> tag in the first bytes. */
export function decodeHtml(buf: Uint8Array, contentType: string): string {
  let charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder("latin1").decode(buf.slice(0, 4096));
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder((charset || "utf-8").toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

// robots.txt

const robotsCache = new Map<string, { rules: { allow: boolean; path: string }[]; at: number }>();

export function parseRobots(txt: string, agent = ROBOTS_UA): { allow: boolean; path: string }[] {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (val || key === "allow") current.rules.push({ allow: key === "allow", path: val });
    } else lastWasAgent = false;
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

export function robotsAllowsPath(rules: { allow: boolean; path: string }[], path: string): boolean {
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    if (!r.path) continue;
    const re = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

export async function robotsAllows(url: URL): Promise<boolean> {
  if (process.env.RESPECT_ROBOTS === "false") return true;
  const origin = url.origin;
  let entry = robotsCache.get(origin);
  if (!entry || Date.now() - entry.at > 3_600_000) {
    let rules: { allow: boolean; path: string }[] = [];
    try {
      const { res } = await safeFetch(new URL("/robots.txt", origin), 4000);
      if (res.ok && (res.headers.get("content-type") ?? "").includes("text")) rules = parseRobots(new TextDecoder().decode(await readLimited(res, 512_000)));
    } catch {
      rules = []; // unreachable robots.txt: allowed
    }
    entry = { rules, at: Date.now() };
    robotsCache.set(origin, entry);
  }
  return robotsAllowsPath(entry.rules, url.pathname + url.search);
}

// Text extraction

const BLOCK = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "SUMMARY", "TABLE", "TBODY", "THEAD", "TFOOT", "UL", "CAPTION",
]);
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "TEMPLATE", "IFRAME", "CANVAS", "BUTTON", "SELECT", "OPTION"]);

interface DomNode {
  nodeType: number;
  nodeValue: string | null;
  tagName?: string;
  childNodes: ArrayLike<DomNode>;
}

/** Turn a DOM subtree into text, keeping paragraph, heading, list and table breaks. */
export function domToText(root: DomNode): string {
  const out: string[] = [];
  const walk = (n: DomNode) => {
    if (n.nodeType === 3) {
      out.push((n.nodeValue ?? "").replace(/\s+/g, " "));
      return;
    }
    if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
    const tag = (n.tagName ?? "").toUpperCase();
    if (SKIP.has(tag)) return;
    if (tag === "BR") return void out.push("\n");
    const kids = () => Array.from(n.childNodes).forEach(walk);
    if (tag === "LI") {
      out.push("\n• ");
      kids();
      out.push("\n");
    } else if (tag === "TR") {
      out.push("\n");
      kids();
      out.push("\n");
    } else if (tag === "TD" || tag === "TH") {
      kids();
      out.push(" | ");
    } else if (BLOCK.has(tag)) {
      out.push("\n");
      kids();
      out.push("\n");
    } else kids();
  };
  walk(root);
  return out.join("").replace(/ \| *(\n|$)/g, "$1");
}

export function cleanText(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

function siteName(url: URL, doc?: Document): string {
  const og = doc?.querySelector('meta[property="og:site_name"]')?.getAttribute("content");
  return (og || url.hostname.replace(/^www\./, "")).trim().slice(0, 120);
}

/** Look through meta tags, JSON-LD and <time> for publish / update dates. */
function dateFromHtml(doc: Document, now: Date): FoundDate | undefined {
  const pick = (sel: string, attr = "content") => doc.querySelector(sel)?.getAttribute(attr) ?? undefined;
  const modified =
    pick('meta[property="article:modified_time"]') || pick('meta[property="og:updated_time"]') || pick('meta[itemprop="dateModified"]') || pick('meta[name="last-modified"]');
  const published =
    pick('meta[property="article:published_time"]') ||
    pick('meta[name="date"]') ||
    pick('meta[name="pubdate"]') ||
    pick('meta[name="publish-date"]') ||
    pick('meta[itemprop="datePublished"]') ||
    pick('meta[name="dc.date"]') ||
    pick('meta[name="DC.date.issued"]');
  let ldMod: string | undefined;
  let ldPub: string | undefined;
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const walk = (o: unknown) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(walk);
        const r = o as Record<string, unknown>;
        if (typeof r.dateModified === "string") ldMod ??= r.dateModified;
        if (typeof r.datePublished === "string") ldPub ??= r.datePublished;
        if (r["@graph"]) walk(r["@graph"]);
      };
      walk(JSON.parse(el.textContent || "null"));
    } catch {
      /* ignore malformed JSON-LD */
    }
  });
  const options: [string | undefined, string, string][] = [
    [modified, "Last updated", "Page metadata (modified time)"],
    [ldMod, "Last updated", "Structured data (dateModified)"],
    [published, "Published", "Page metadata (published time)"],
    [ldPub, "Published", "Structured data (datePublished)"],
    [pick("time[datetime]", "datetime"), "Published", "A <time> tag on the page"],
  ];
  for (const [raw, label, evidence] of options) {
    if (!raw) continue;
    const d = parseLooseDate(raw);
    if (d && isPlausiblePublishDate(d, now)) return { date: d, label, evidence };
  }
  return undefined;
}

/** Parse fetched HTML into a Source (exported so it can be tested offline). */
export function htmlToSource(html: string, finalUrl: URL, id: string, now = new Date()): Source {
  const { document } = parseHTML(html);
  const doc = document as unknown as Document;
  const metaDate = dateFromHtml(doc, now);
  const site = siteName(finalUrl, doc);
  const rawTitle = document.querySelector("title")?.textContent?.trim() || finalUrl.hostname;

  let text = "";
  let title = rawTitle;
  try {
    const article = new Readability(parseHTML(html).document as unknown as Document).parse();
    if (article?.content && (article.textContent ?? "").trim().length > 200) {
      const { document: frag } = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`);
      text = domToText(frag.body as unknown as DomNode);
      title = article.title?.trim() || rawTitle;
    }
  } catch {
    /* fall through to whole-page extraction */
  }
  if (!text.trim()) {
    document.querySelectorAll("script,style,noscript,nav,footer,header,svg,form,aside").forEach((el) => el.remove());
    text = document.body ? domToText(document.body as unknown as DomNode) : "";
  }
  text = cleanText(text);
  if (text.length < 120) throw new FetchError("Couldn't find readable text on that page (it may need JavaScript or a login). Paste the text instead.", 422, "content");

  const textDate = metaDate ? undefined : findDateInText(text, now);
  const date = metaDate ?? textDate;
  const url = finalUrl.toString();
  return {
    id,
    kind: "url",
    url,
    title: title.slice(0, 200),
    site,
    sourceType: classifySource(url),
    publishedDate: date?.date,
    dateLabel: date?.label,
    dateEvidence: date?.evidence,
    dateConfidence: metaDate ? "found" : textDate ? "inferred" : "none",
    cycleMentions: findCycleMentions(text),
    text,
    fetchedAt: now.toISOString(),
    via: "direct",
  };
}

export async function pdfToSource(data: Uint8Array, id: string, name: string, now = new Date()): Promise<Source> {
  let text = "";
  let info: Record<string, unknown> = {};
  try {
    const pdf = await getDocumentProxy(data);
    const out = await extractText(pdf, { mergePages: false });
    text = (Array.isArray(out.text) ? out.text : [out.text]).join("\n\n");
    try {
      info = (await getMeta(pdf)).info ?? {};
    } catch {
      info = {};
    }
  } catch {
    throw new FetchError("Couldn't read that PDF. If it's a scanned image, paste its text instead.", 422, "content");
  }
  text = cleanText(text);
  if (text.length < 80) throw new FetchError("That PDF has no selectable text (it may be a scanned image). Paste its text instead.", 422, "content");
  const metaTitle = typeof info.Title === "string" && info.Title.trim().length > 3 && !/^untitled|microsoft word/i.test(info.Title) ? info.Title.trim() : undefined;
  const mod = parsePdfDate(info.ModDate as string | undefined);
  const created = parsePdfDate(info.CreationDate as string | undefined);
  const textDate = findDateInText(text, now);
  // A date printed on the document beats file metadata, which is often just the export time.
  const date: FoundDate | undefined =
    textDate ??
    (mod && isPlausiblePublishDate(mod, now)
      ? { date: mod, label: "Last updated", evidence: "PDF properties (modified date)" }
      : created && isPlausiblePublishDate(created, now)
        ? { date: created, label: "Published", evidence: "PDF properties (creation date)" }
        : undefined);
  return {
    id,
    kind: "pdf",
    title: (metaTitle ?? name.replace(/\.pdf$/i, "")).slice(0, 200),
    site: "Uploaded PDF",
    sourceType: "document",
    publishedDate: date?.date,
    dateLabel: date?.label,
    dateEvidence: date?.evidence,
    dateConfidence: textDate ? "inferred" : date ? "found" : "none",
    cycleMentions: findCycleMentions(text),
    text,
    fetchedAt: now.toISOString(),
    via: "upload",
  };
}

export interface SearchFallback {
  text: string;
  title?: string;
  date?: string;
}

/** Build a source from the search service's copy of a page the site wouldn't let us read. */
function fromSearchService(url: URL, id: string, fb: SearchFallback, why: string, now: Date): Source {
  const text = cleanText(fb.text);
  if (text.length < 120) throw new FetchError(`${why} The search service had no usable copy either. Paste the text instead.`, 422, "content");
  const given = fb.date ? parseLooseDate(fb.date) : undefined;
  const found = given && isPlausiblePublishDate(given, now) ? undefined : findDateInText(text, now);
  const u = url.toString();
  return {
    id,
    kind: "url",
    url: u,
    title: (fb.title || url.hostname).slice(0, 200),
    site: url.hostname.replace(/^www\./, ""),
    sourceType: classifySource(u),
    publishedDate: given && isPlausiblePublishDate(given, now) ? given : found?.date,
    dateLabel: given && isPlausiblePublishDate(given, now) ? "Published" : found?.label,
    dateEvidence: given && isPlausiblePublishDate(given, now) ? "Search service listing" : found?.evidence,
    dateConfidence: given || found ? "inferred" : "none",
    cycleMentions: findCycleMentions(text),
    text,
    fetchedAt: now.toISOString(),
    via: "search-service",
    note: `${why} This text is the search service's copy of the page; open the original to compare.`,
  };
}

export async function fetchUrlSource(rawUrl: string, id: string, fallback?: SearchFallback): Promise<Source> {
  const now = new Date();
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new FetchError("That doesn't look like a valid web address.", 422, "input");
  }
  try {
    if (!(await robotsAllows(url)))
      throw new FetchError("This site asks automated tools not to read this page (robots.txt).", 451, "robots");
    const { res, finalUrl } = await safeFetch(url, 20_000);
    if (!res.ok) throw new FetchError(`The site returned an error (${res.status}); it may block automated reading.`, 422, "http");
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const isPdf = type.includes("pdf") || finalUrl.pathname.toLowerCase().endsWith(".pdf");
    if (!isPdf && type && !/text\/html|application\/xhtml|text\/plain|application\/xml|text\/xml/.test(type))
      throw new FetchError("That link isn't a web page or PDF.", 415, "content");
    const buf = await readLimited(res, MAX_BYTES);
    if (isPdf) {
      const src = await pdfToSource(buf, id, finalUrl.pathname.split("/").pop() || "PDF document", now);
      const t = classifySource(finalUrl.toString());
      return { ...src, kind: "url", url: finalUrl.toString(), site: finalUrl.hostname.replace(/^www\./, ""), sourceType: t === "other" ? "document" : t, via: "direct" };
    }
    if (type.includes("text/plain")) {
      const text = cleanText(decodeHtml(buf, type));
      if (text.length < 120) throw new FetchError("That page has almost no text.", 422, "content");
      const d = findDateInText(text, now);
      return {
        id,
        kind: "url",
        url: finalUrl.toString(),
        title: finalUrl.pathname.split("/").pop() || finalUrl.hostname,
        site: finalUrl.hostname.replace(/^www\./, ""),
        sourceType: classifySource(finalUrl.toString()),
        publishedDate: d?.date,
        dateLabel: d?.label,
        dateEvidence: d?.evidence,
        dateConfidence: d ? "inferred" : "none",
        cycleMentions: findCycleMentions(text),
        text,
        fetchedAt: now.toISOString(),
        via: "direct",
      };
    }
    return htmlToSource(decodeHtml(buf, type), finalUrl, id, now);
  } catch (e) {
    if (fallback?.text && e instanceof FetchError && e.code !== "blocked" && e.code !== "input") {
      return fromSearchService(url, id, fallback, e.message, now);
    }
    if (e instanceof FetchError && (e.code === "http" || e.code === "network" || e.code === "content" || e.code === "robots")) {
      throw new FetchError(`${e.message} Paste the page's text instead.`, e.status, e.code);
    }
    throw e;
  }
}

export function textToSource(args: { id: string; title: string; text: string; date?: string; isAiAnswer?: boolean; url?: string }): Source {
  const now = new Date();
  const text = cleanText(args.text);
  if (text.length < 40) throw new FetchError("Paste at least a few sentences of text.", 422, "input");
  let explicit: string | undefined;
  if (args.date?.trim()) {
    explicit = parseLooseDate(args.date);
    if (!explicit) throw new FetchError(`Couldn't read the date "${args.date}". Use a format like 12 Aug 2026.`, 422, "input");
    if (!isPlausiblePublishDate(explicit, now)) throw new FetchError("That date is in the future. Enter when the text was published or last updated.", 422, "input");
  }
  const found = explicit ? undefined : findDateInText(text, now);
  const url = args.url && hostOf(args.url) ? args.url : undefined;
  return {
    id: args.id,
    kind: "text",
    url,
    title: args.title.trim().slice(0, 200) || (args.isAiAnswer ? "AI chatbot answer" : "Pasted text"),
    site: args.isAiAnswer ? "AI chatbot" : url ? hostOf(url) : "Pasted by user",
    sourceType: args.isAiAnswer ? "ai-answer" : url ? classifySource(url) : "other",
    publishedDate: args.isAiAnswer ? undefined : (explicit ?? found?.date),
    dateLabel: args.isAiAnswer ? undefined : explicit ? "Date given by user" : found?.label,
    dateEvidence: args.isAiAnswer ? undefined : explicit ? "Entered by the user" : found?.evidence,
    dateConfidence: explicit ? "found" : found ? "inferred" : "none",
    cycleMentions: args.isAiAnswer ? [] : findCycleMentions(text),
    text,
    fetchedAt: now.toISOString(),
    via: "pasted",
    note: args.isAiAnswer ? "Pasted AI answer. It's checked like any other source but never treated as evidence on its own." : undefined,
  };
}
