// Sample scenario 1: a student concession pass (fictional city "Ambarpur").
// Every organisation, address and document here is invented for the demo.

import type { AiFindings, SubQuestion } from "../types";
import type { RawClaim, RawSource, SampleScenario } from "./types";

const RAW: RawSource[] = [
  {
    id: "s1",
    title: "Student Concession Pass — Frequently Asked Questions",
    site: "Ambarpur Metro Rail (sample)",
    url: "https://ambarpurmetro.example/student-pass/faq",
    type: "official",
    text: `Student Concession Pass — Frequently Asked Questions
Last updated: 12 August 2026

Who can apply?
Full-time students aged 12 to 25 who are enrolled in a school, college or university recognised by the State Education Board and located within Ambarpur district can apply for the Student Concession Pass.

How much is the concession?
Pass holders get a 40% concession on the regular smart-card fare for every journey on the Blue, Green and Orange lines.

What documents do I need?
You need a valid college or school identity card and a mobile number linked to your Aadhaar for OTP verification. Upload a clear photo of the identity card while applying.

How do I apply?
Applications are accepted only through the online student portal. After approval, collect your pass card from any customer care centre by showing the approval SMS.

Is there a fee for the card?
A one-time card issuance fee of ₹50 is charged when you collect the pass card.

How long is the pass valid?
The pass is valid for one academic session and expires on 31 July every year.

For other questions, contact the customer care centre at any station.`,
  },
  {
    id: "s2",
    title: "Ambarpur Metro launches 50% fare concession for students",
    site: "Ambarpur Daily (sample)",
    url: "https://ambarpurdaily.example/city/metro-student-concession",
    type: "news",
    text: `Ambarpur Metro launches 50% fare concession for students
Published: 3 March 2024

Ambarpur Metro Rail has announced a student concession pass that will give students a 50% discount on metro fares from the 2024-25 academic session. Officials said the scheme is meant to reduce travel costs for students who commute daily to colleges across the city.

Students of recognised institutions will be eligible for the concession. To apply, students must submit a bonafide certificate issued by their institution along with a photo identity card.

The metro expects nearly two lakh students to benefit from the scheme in its first year. Officials said the pass will be valid on all operational lines and that more details on the application process will be shared before the session begins.`,
  },
  {
    id: "s3",
    title: "Student metro pass in Ambarpur: everything you need to know",
    site: "CampusHacks blog (sample)",
    url: "https://campushacks.example/ambarpur-student-metro-pass",
    type: "blog",
    text: `Student metro pass in Ambarpur: everything you need to know

Ambarpur Metro Rail has announced a student concession pass that will give students a 50% discount on metro fares from the 2024-25 academic session. The scheme is meant to reduce travel costs for students who commute daily to colleges across the city.

To apply, students must submit a bonafide certificate issued by their institution along with a photo identity card. Students of recognised institutions will be eligible for the concession.

Good news for second-year students: renewal is automatic, so once you have the pass you do not need to apply again next year. Just keep using your card.

Tip: carry your college ID while travelling, as staff may ask to see it.`,
  },
  {
    id: "s4",
    title: "Student metro pass renewal — anyone done it?",
    site: "Ambarpur Students Forum (sample)",
    url: "https://forum.ambarpurstudents.example/t/student-pass-renewal",
    type: "forum",
    text: `Student metro pass renewal — anyone done it?
Posted on 15 January 2026

Original post: My pass expires in July. Do I need to apply again or does it renew on its own? The FAQ page says nothing about renewal.

Reply 1: I had to reapply last year. Renewal is not automatic — you submit a fresh application each session with a new bonafide certificate.

Reply 2: When I applied on the portal in December it asked me for a bonafide certificate, not just the college ID card. Maybe they changed it.

Reply 3: Does anyone know if the pass works on the new Airport Express line? Nobody at the counter could tell me.

Reply 4: Also, is there a last date to apply for the new session? I could not find one anywhere.`,
  },
  {
    id: "s5",
    title: "Press note: Revision of student concession",
    site: "Ambarpur Transport Department (sample)",
    url: "https://transport.ambarpur.example/press/student-concession-revision",
    type: "official",
    text: `Press note: Revision of student concession
Date: 2 December 2025

The Transport Department has approved a revision of the metro student concession. From 1 January 2026, the concession will be 40% of the regular smart-card fare instead of 50%. The upper age limit for eligibility has been extended to 25 years.

Applications for the student pass will move fully online through the student portal. Counter applications will be discontinued.

The revised scheme will be reviewed after one year.`,
  },
  {
    id: "s6",
    title: "Answer from an AI chatbot (sample)",
    site: "AI chatbot",
    type: "ai-answer",
    text: `The Ambarpur Metro student pass gives a 50% discount on metro fares. It is available to students up to 21 years of age who study at recognised institutions. You can apply at any metro station counter by showing your college ID card. The pass is valid for one year.`,
  },
];

const SUBQUESTIONS: SubQuestion[] = [
  { id: "q1", text: "Who is eligible (age, institution, location)?", importance: "critical", volatility: "medium", why: "If you don't qualify, the application will be rejected." },
  { id: "q2", text: "How much is the fare concession now?", importance: "important", volatility: "fast", why: "The discount decides how much you actually save." },
  { id: "q3", text: "Which documents are required to apply?", importance: "critical", volatility: "medium", why: "Wrong or missing documents are a common reason applications get delayed." },
  { id: "q4", text: "How and where do you apply?", importance: "critical", volatility: "medium", why: "Applying through the wrong channel wastes a trip." },
  { id: "q5", text: "Is there an application deadline for the current session?", importance: "critical", volatility: "fast", why: "Missing the window could mean paying full fare for months." },
  { id: "q6", text: "How does renewal work for the next session?", importance: "important", volatility: "medium", why: "You need to know whether to reapply before the pass expires." },
  { id: "q7", text: "Are there fees, validity limits or lines where it doesn't apply?", importance: "optional", volatility: "medium", why: "Hidden fees or excluded lines change how useful the pass is." },
];

// Saved output of the extraction step. s4c3 is a deliberately mismatched
// quote, kept to show the verbatim check downgrading it to "uncertain".
const CLAIMS: RawClaim[] = [
  { id: "s1c1", sourceId: "s1", subQuestionId: "q1", claim: "Full-time students aged 12–25 at recognised institutions in Ambarpur district can apply.", quote: "Full-time students aged 12 to 25 who are enrolled in a school, college or university recognised by the State Education Board" },
  { id: "s1c2", sourceId: "s1", subQuestionId: "q2", claim: "Pass holders get a 40% concession on regular smart-card fares.", quote: "Pass holders get a 40% concession on the regular smart-card fare for every journey" },
  { id: "s1c3", sourceId: "s1", subQuestionId: "q3", claim: "A valid college or school ID card and an Aadhaar-linked mobile number are needed.", quote: "You need a valid college or school identity card and a mobile number linked to your Aadhaar for OTP verification." },
  { id: "s1c4", sourceId: "s1", subQuestionId: "q4", claim: "Applications are accepted only through the online student portal.", quote: "Applications are accepted only through the online student portal." },
  { id: "s1c5", sourceId: "s1", subQuestionId: "q7", claim: "A one-time ₹50 card issuance fee is charged.", quote: "A one-time card issuance fee of ₹50 is charged when you collect the pass card." },
  { id: "s1c6", sourceId: "s1", subQuestionId: "q7", claim: "The pass lasts one academic session and expires on 31 July each year.", quote: "The pass is valid for one academic session and expires on 31 July every year." },
  { id: "s1c7", sourceId: "s1", subQuestionId: "q7", claim: "The concession applies on the Blue, Green and Orange lines.", quote: "for every journey on the Blue, Green and Orange lines" },
  { id: "s2c1", sourceId: "s2", subQuestionId: "q2", claim: "Students get a 50% discount from the 2024-25 session.", quote: "will give students a 50% discount on metro fares from the 2024-25 academic session", timeReference: "2024-25 academic session" },
  { id: "s2c2", sourceId: "s2", subQuestionId: "q1", claim: "Students of recognised institutions are eligible.", quote: "Students of recognised institutions will be eligible for the concession." },
  { id: "s2c3", sourceId: "s2", subQuestionId: "q3", claim: "Applicants must submit a bonafide certificate and a photo ID.", quote: "students must submit a bonafide certificate issued by their institution along with a photo identity card" },
  { id: "s3c1", sourceId: "s3", subQuestionId: "q2", claim: "Students get a 50% discount from the 2024-25 session.", quote: "will give students a 50% discount on metro fares from the 2024-25 academic session", timeReference: "2024-25 academic session" },
  { id: "s3c2", sourceId: "s3", subQuestionId: "q3", claim: "Applicants must submit a bonafide certificate and a photo ID.", quote: "students must submit a bonafide certificate issued by their institution along with a photo identity card" },
  { id: "s3c3", sourceId: "s3", subQuestionId: "q6", claim: "Renewal is automatic; no need to apply again next year.", quote: "renewal is automatic, so once you have the pass you do not need to apply again next year" },
  { id: "s4c1", sourceId: "s4", subQuestionId: "q6", claim: "Renewal is not automatic; students reapply each session with a new bonafide certificate.", quote: "Renewal is not automatic — you submit a fresh application each session with a new bonafide certificate." },
  { id: "s4c2", sourceId: "s4", subQuestionId: "q3", claim: "In December the portal asked for a bonafide certificate, not just the college ID.", quote: "it asked me for a bonafide certificate, not just the college ID card" },
  { id: "s4c3", sourceId: "s4", subQuestionId: "q5", claim: "Applications close on 30 September each year.", quote: "applications for the new session close on 30 September each year" },
  { id: "s5c1", sourceId: "s5", subQuestionId: "q2", claim: "From 1 January 2026 the concession is 40% instead of 50%.", quote: "From 1 January 2026, the concession will be 40% of the regular smart-card fare instead of 50%.", timeReference: "from 1 January 2026" },
  { id: "s5c2", sourceId: "s5", subQuestionId: "q1", claim: "The upper age limit was extended to 25 years.", quote: "The upper age limit for eligibility has been extended to 25 years." },
  { id: "s5c3", sourceId: "s5", subQuestionId: "q4", claim: "Applications move fully online through the student portal.", quote: "Applications for the student pass will move fully online through the student portal." },
  { id: "s6c1", sourceId: "s6", subQuestionId: "q2", claim: "The pass gives a 50% discount.", quote: "The Ambarpur Metro student pass gives a 50% discount on metro fares." },
  { id: "s6c2", sourceId: "s6", subQuestionId: "q1", claim: "Students up to 21 years old are eligible.", quote: "It is available to students up to 21 years of age" },
  { id: "s6c3", sourceId: "s6", subQuestionId: "q4", claim: "You can apply at any station counter with your college ID.", quote: "You can apply at any metro station counter by showing your college ID card." },
];

const RAISED: { sourceId: string; question: string }[] = [
  { sourceId: "s4", question: "Does the pass work on the new Airport Express line?" },
  { sourceId: "s4", question: "Is there a last date to apply for the new session?" },
];

// Saved output of the analysis step.
const AI: AiFindings = {
  summaries: [
    { subQuestionId: "q1", summary: "Sources agree that full-time students of recognised institutions qualify. The official FAQ gives an age range of 12 to 25 [s1c1], matching the press note's extension to 25 [s5c2]; the pasted AI answer still says 21 [s6c2]." },
    { subQuestionId: "q2", summary: "The official FAQ [s1c2] and the December 2025 press note [s5c1] give 40%, while a March 2024 news report [s2c1] and an undated blog [s3c1] give 50%." },
    { subQuestionId: "q3", summary: "The official FAQ asks for a college or school ID and an Aadhaar-linked mobile [s1c3], but older pages [s2c3, s3c2] and a January 2026 forum reply [s4c2] mention a bonafide certificate." },
    { subQuestionId: "q4", summary: "The official FAQ [s1c4] and the press note [s5c3] both describe online-only applications through the student portal." },
    { subQuestionId: "q5", summary: "No source states a deadline. One extracted mention of a closing date could not be found on the page [s4c3]." },
    { subQuestionId: "q6", summary: "An undated blog says renewal is automatic [s3c3]; a January 2026 forum reply says students must reapply each session [s4c1]. The official FAQ does not mention renewal." },
    { subQuestionId: "q7", summary: "Only the official FAQ mentions a ₹50 card fee, a 31 July expiry and the Blue, Green and Orange lines [s1c5, s1c6, s1c7]." },
  ],
  conflicts: [
    {
      subQuestionId: "q2",
      claimIds: ["s1c2", "s5c1", "s2c1", "s3c1"],
      summary: "The official FAQ and the December 2025 press note say 40%; a March 2024 news report and an undated blog say 50%.",
      likelyReason: "different-time",
      explanation: "The press note says the concession changed from 50% to 40% on 1 January 2026, so the 50% figures likely describe the earlier scheme.",
      howToResolve: "Check the current fare page or the latest official notice for the concession rate.",
      confidence: "high",
    },
    {
      subQuestionId: "q3",
      claimIds: ["s1c3", "s4c2", "s2c3"],
      summary: "The official FAQ asks for a college or school ID card; a January 2026 forum reply says the portal asked for a bonafide certificate.",
      likelyReason: "unclear",
      explanation: "The FAQ was updated in August 2026 and the forum post is from January 2026, so either the rule changed or the portal and the FAQ disagree. The forum account is one person's experience.",
      howToResolve: "Start an application on the official portal and note exactly which documents it asks for, or ask customer care.",
      confidence: "medium",
    },
    {
      subQuestionId: "q6",
      claimIds: ["s3c3", "s4c1"],
      summary: "An undated blog says renewal is automatic; a January 2026 forum reply says students must reapply each session.",
      likelyReason: "genuine",
      explanation: "Both describe the same pass. The blog has no date and repeats an older news report, and the official FAQ is silent, so neither account can be confirmed from these sources.",
      howToResolve: "Ask metro customer care, or check the student portal for a renewal option.",
      confidence: "medium",
    },
    {
      subQuestionId: "q1",
      claimIds: ["s6c2", "s1c1"],
      summary: "The pasted AI answer says students up to 21 are eligible; the official FAQ says 12 to 25.",
      likelyReason: "different-time",
      explanation: "The press note says the upper age limit was extended to 25, so the AI answer may be repeating older information.",
      howToResolve: "Rely on the official FAQ's age range and confirm it on the application form.",
      confidence: "high",
    },
    {
      subQuestionId: "q2",
      claimIds: ["s6c1", "s1c2"],
      summary: "The pasted AI answer says 50%; the official FAQ says 40%.",
      likelyReason: "different-time",
      explanation: "The 50% figure matches the 2024 scheme that the December 2025 press note says was revised.",
      howToResolve: "Check the latest official fare notice.",
      confidence: "high",
    },
    {
      subQuestionId: "q4",
      claimIds: ["s6c3", "s1c4"],
      summary: "The pasted AI answer says to apply at a station counter; the official FAQ says applications are online only.",
      likelyReason: "different-time",
      explanation: "The press note says counter applications were discontinued, so the AI answer may describe the old process.",
      howToResolve: "Use the official student portal and confirm there is no counter option.",
      confidence: "high",
    },
  ],
  outdated: [
    { sourceId: "s2", claimId: "s2c1", reason: "The 50% figure appears to have been replaced by the 40% rate announced in the December 2025 press note." },
    { sourceId: "s3", claimId: "s3c1", reason: "Repeats the 2024 figure of 50%, which newer official sources no longer use." },
  ],
  openQuestions: [
    { question: "Does the concession apply on the new Airport Express line?", raisedBySourceIds: ["s4"], subQuestionId: "q7" },
    { question: "What is the last date to apply for the current session?", raisedBySourceIds: ["s4"], subQuestionId: "q5" },
    { question: "Can students who live in Ambarpur but study outside the district apply?", raisedBySourceIds: [], subQuestionId: "q1" },
  ],
  checklist: [
    {
      priority: "critical",
      task: "Confirm the exact document list on the official student portal before applying.",
      whereToVerify: "The application form on the official student portal, or metro customer care",
      searchQuery: "Ambarpur Metro student pass documents bonafide certificate",
      why: "The official FAQ and a recent student report disagree on whether a bonafide certificate is needed.",
      askSource: "Hello, the student pass FAQ lists a college ID card, but some students say the portal asks for a bonafide certificate. Could you confirm which documents are currently required?",
      relatedIds: ["q3", "s1c3"],
      origin: "conflict",
    },
    {
      priority: "critical",
      task: "Find the application deadline for the current session.",
      whereToVerify: "The latest official notice or the student portal",
      searchQuery: "Ambarpur Metro student pass last date to apply",
      why: "No reviewed source gives a deadline, and missing it could mean paying full fare.",
      askSource: "Hello, is there a last date to apply for the student concession pass for the current session?",
      relatedIds: ["q5"],
      origin: "gap",
    },
    {
      priority: "important",
      task: "Check whether the pass renews automatically or needs a fresh application.",
      whereToVerify: "Metro customer care or the renewal section of the student portal",
      searchQuery: "Ambarpur Metro student pass renewal",
      why: "Sources disagree and the official FAQ doesn't cover renewal.",
      askSource: "Hello, my student pass expires on 31 July. Do I need to submit a new application for the next session, or does it renew automatically?",
      relatedIds: ["q6", "s3c3"],
      origin: "conflict",
    },
    {
      priority: "important",
      task: "Confirm the current concession rate on the official fare page.",
      whereToVerify: "The official fare chart or the latest press note",
      searchQuery: "Ambarpur Metro student concession rate",
      why: "Older pages and the AI answer still show 50%, which the December 2025 press note replaced with 40%.",
      relatedIds: ["q2", "s1c2"],
      origin: "outdated",
    },
    {
      priority: "optional",
      task: "Ask whether the pass is valid on the Airport Express line.",
      whereToVerify: "Metro customer care",
      searchQuery: "Ambarpur Metro Airport Express student pass",
      why: "The FAQ lists three lines and a student reports that counter staff didn't know.",
      askSource: "Hello, can the student concession pass be used on the Airport Express line?",
      relatedIds: ["q7"],
      origin: "open-question",
    },
    {
      priority: "optional",
      task: "Confirm the ₹50 card issuance fee with a second source.",
      whereToVerify: "The fee notice at a customer care centre",
      searchQuery: "Ambarpur Metro student pass card fee",
      why: "Only one source mentions it.",
      relatedIds: ["q7", "s1c5"],
      origin: "single-source",
    },
  ],
};


// An official notice the user can add from the checklist ("Find a source for
// this") to watch the deadline gap close on re-run.
const EXTRA_SOURCE: RawSource = {
  id: "s7",
  title: "Notice: Student concession pass — applications for 2026-27",
  site: "Ambarpur Metro Rail (sample)",
  url: "https://ambarpurmetro.example/notices/student-pass-2026-27",
  type: "official",
  text: `Notice: Student concession pass — applications for 2026-27
Ref. No. AMR/SC/2026/114
Date: 20 October 2026

Applications for the student concession pass for the 2026-27 academic session are open on the online student portal. The last date to apply is 30 November 2026. Late applications will not be accepted.

For eligibility, documents and fares, see the Student Concession Pass FAQ.`,
};

const EXTRA_CLAIMS: RawClaim[] = [
  { id: "s7c1", sourceId: "s7", subQuestionId: "q5", claim: "Applications for 2026-27 close on 30 November 2026.", quote: "The last date to apply is 30 November 2026.", timeReference: "2026-27 academic session" },
  { id: "s7c2", sourceId: "s7", subQuestionId: "q4", claim: "Applications are made on the online student portal.", quote: "are open on the online student portal" },
];

function withExtra(ai: AiFindings): AiFindings {
  const out: AiFindings = structuredClone(ai);
  out.summaries = out.summaries.map((s) =>
    s.subQuestionId === "q5"
      ? { ...s, summary: "An official notice dated 20 October 2026 gives 30 November 2026 as the last date to apply [s7c1]. One other extracted mention could not be found on its page [s4c3]." }
      : s.subQuestionId === "q4"
        ? { ...s, summary: "The official FAQ [s1c4], the press note [s5c3] and the October 2026 notice [s7c2] all describe online-only applications through the student portal." }
        : s,
  );
  out.openQuestions = out.openQuestions.filter((o) => o.subQuestionId !== "q5");
  out.checklist = out.checklist.map((c) =>
    c.relatedIds.includes("q5")
      ? {
          priority: "important",
          task: "Confirm the 30 November 2026 deadline on the student portal.",
          whereToVerify: "The student portal or the official notice",
          searchQuery: "Ambarpur Metro student pass 2026-27 last date",
          why: "Only one source states the deadline, though it is a recent official notice.",
          askSource: "Hello, can you confirm that 30 November 2026 is the last date to apply for the 2026-27 student concession pass?",
          relatedIds: ["q5", "s7c1"],
          origin: "single-source",
        }
      : c,
  );
  return out;
}

export const AMBARPUR: SampleScenario = {
  id: "ambarpur",
  title: "Student concession pass",
  blurb: "A student checks a metro pass scheme: an official FAQ, a press note, an old news report, a copied blog, a forum thread and a chatbot answer.",
  question: "What should I verify before applying for the Ambarpur Metro student concession pass?",
  subQuestions: SUBQUESTIONS,
  raw: RAW,
  claims: CLAIMS,
  raised: RAISED,
  ai: AI,
  extra: { source: EXTRA_SOURCE, claims: EXTRA_CLAIMS, topicIds: ["q5"], patch: withExtra },
};
