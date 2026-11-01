import type { SourceType } from "./types";

const NEWS = [
  "timesofindia", "hindustantimes", "indianexpress", "thehindu", "ndtv", "indiatoday",
  "livemint", "economictimes", "business-standard", "news18", "scroll.in", "thewire",
  "theprint", "deccanherald", "tribuneindia", "bbc.", "reuters", "apnews", "nytimes",
  "theguardian", "washingtonpost", "cnn.", "aljazeera", "moneycontrol", "financialexpress",
  "businesstoday", "outlookindia", "firstpost", "newindianexpress", "telegraphindia",
  "thequint", "newslaundry", "zeenews", "abplive", "republicworld", "dnaindia",
];
/** Exam-prep, coaching and listing sites that repackage official information. */
const AGGREGATOR = [
  "shiksha", "collegedunia", "careers360", "jagranjosh", "sarkariresult", "freejobalert",
  "indiaeducation", "buddy4study", "embibe", "testbook", "adda247", "collegedekho",
  "getmyuni", "vidhyaa", "aglasem", "studyiq", "byjus", "unacademy", "safalta", "naukri",
  "govtjobguru", "sarkarinaukri", "scholarshipsforstudents", "indiascholarships", "govschemes",
];
const FORUM = ["reddit.", "quora.", "stackexchange", "stackoverflow", "forum", "community.", "discourse", "teambhp"];
const REFERENCE = ["wikipedia.org", "britannica.com", "wikihow"];
const BLOG = ["medium.com", "blogspot", "wordpress", "substack", "/blog", "blog."];
/** Official bodies whose domains don't end in .gov / .nic.in. */
const OFFICIAL_HOSTS = ["nta.ac.in", "rbi.org.in", "mygov.in", "irctc.co.in", "who.int", "un.org", "uidai.gov.in", "ugc.ac.in", "aicte-india.org", "cbse.gov.in"];

export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function classifySource(url: string | undefined): SourceType {
  const host = hostOf(url);
  if (!host) return "other";
  const full = url!.toLowerCase();
  if (
    /(^|\.)(gov|gov\.in|nic\.in|gov\.uk|gc\.ca|gov\.au|europa\.eu|int|mil)$/.test(host) ||
    host.includes(".gov.") ||
    OFFICIAL_HOSTS.some((h) => host === h || host.endsWith("." + h))
  )
    return "official";
  if (/\.(edu|ac\.in|ac\.uk|edu\.in)$/.test(host) || host.includes("arxiv") || host.includes("ncbi.nlm") || host.includes("doi.org"))
    return "academic";
  if (FORUM.some((f) => full.includes(f))) return "forum";
  if (REFERENCE.some((f) => host.includes(f))) return "reference";
  if (AGGREGATOR.some((f) => host.includes(f))) return "aggregator";
  if (NEWS.some((f) => host.includes(f))) return "news";
  if (BLOG.some((f) => full.includes(f))) return "blog";
  return "other";
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  official: "Official",
  news: "News",
  blog: "Blog",
  forum: "Forum",
  reference: "Reference",
  academic: "Academic",
  aggregator: "Aggregator",
  "ai-answer": "AI chatbot answer",
  document: "Document",
  other: "Website",
};

/** Types a user may assign by hand (an AI answer is chosen when it's added). */
export const EDITABLE_TYPES: SourceType[] = ["official", "news", "academic", "reference", "aggregator", "blog", "forum", "document", "other"];
