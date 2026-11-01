// Sample scenario 2: a city water advisory (fictional city "Riverton").
// A fast-changing public notice: shows outdated reporting, an unsourced
// forwarded message, a stale chatbot answer and the rule-based number check.
// Every organisation, place and document here is invented for the demo.

import type { AiFindings, SubQuestion } from "../types";
import type { RawClaim, RawSource, SampleScenario } from "./types";

const RAW: RawSource[] = [
  {
    id: "s1",
    title: "Water supply advisory — East Ward, Lakeview Colony and Hill Road",
    site: "Riverton Municipal Corporation (sample)",
    url: "https://riverton-mc.example/water/advisory",
    type: "official",
    text: `Water supply advisory — East Ward, Lakeview Colony and Hill Road
Riverton Municipal Corporation
Last updated: 29 October 2026

The boil-water advisory issued on 18 October 2026 for East Ward and Lakeview Colony was lifted on 28 October 2026 after laboratory tests met drinking water standards. Residents of these areas can use tap water normally. Run each tap for two minutes before first use.

Hill Road remains under the boil-water advisory until repairs to the damaged main pipeline are completed. Residents of Hill Road should bring drinking water to a rolling boil for at least 1 minute and let it cool before use.

Water tankers are available at the Hill Road community hall from 7 am to 7 pm.

The contamination was caused by a damaged main pipeline near Hill Road, which allowed untreated water to enter the supply.

Further updates will be posted on this page.`,
  },
  {
    id: "s2",
    title: "Boil-water advisory for East Ward after supply contamination",
    site: "Riverton Times (sample)",
    url: "https://rivertontimes.example/city/boil-water-advisory-east-ward",
    type: "news",
    text: `Boil-water advisory for East Ward after supply contamination
Published: 19 October 2026

The Riverton Municipal Corporation on Saturday asked residents of East Ward and Lakeview Colony to boil drinking water for at least 1 minute after tests found bacteria in the supply. Officials said a damaged main pipeline near Hill Road had let untreated water into the network.

The advisory is expected to remain in force for at least two weeks while the pipeline is repaired and the network is flushed. Residents have been advised to avoid drinking unboiled tap water during this period.`,
  },
  {
    id: "s3",
    title: "How to make tap water safe during a boil-water notice",
    site: "Healthy Home Tips blog (sample)",
    url: "https://healthyhometips.example/boil-water-notice",
    type: "blog",
    text: `How to make tap water safe during a boil-water notice

When your city issues a boil-water notice, boiling is the simplest way to make water safe to drink. Experts recommend that you boil water for 10 minutes to kill all germs before drinking it or using it for cooking.

Let the water cool in a clean, covered container. Use boiled or bottled water for brushing teeth and washing fruit.`,
  },
  {
    id: "s4",
    title: "East Ward water — is it safe now?",
    site: "Riverton Residents Forum (sample)",
    url: "https://forum.riverton-residents.example/t/east-ward-water",
    type: "forum",
    text: `East Ward water — is it safe now?
Posted on 30 October 2026

Original post: The corporation's page says the advisory for East Ward was lifted on 28 October, but my tap water still smells of chlorine. Is it safe to drink?

Reply 1: The smell is normal after the lines are flushed. We have been using it since yesterday.

Reply 2: Hill Road is still under the advisory. Tankers are parked at the Hill Road community hall during the day.

Reply 3: Has anyone seen the actual test results? The corporation only says the tests met standards.`,
  },
  {
    id: "s5",
    title: "Forwarded message (sample)",
    site: "Messaging app forward (sample)",
    type: "other",
    text: `FORWARDED AS RECEIVED: URGENT!! Riverton water is contaminated with chemicals across the whole city. Do not use tap water even for bathing until 15 November. Share with all groups!!`,
  },
  {
    id: "s6",
    title: "Answer from an AI chatbot (sample)",
    site: "AI chatbot",
    type: "ai-answer",
    text: `Riverton's boil-water advisory is currently in force for East Ward and Lakeview Colony. Residents should boil water for 10 minutes before drinking. The advisory is expected to last about two weeks from 18 October 2026.`,
  },
];

const SUBQUESTIONS: SubQuestion[] = [
  { id: "q1", text: "Is the advisory still in force?", importance: "critical", volatility: "fast", why: "Following an old advisory wastes effort; ignoring a current one risks illness." },
  { id: "q2", text: "Which areas are covered right now?", importance: "critical", volatility: "fast", why: "An advisory can be lifted for some areas and stay in place for others." },
  { id: "q3", text: "How long should water be boiled while it applies?", importance: "important", volatility: "medium", why: "Residents need one clear instruction." },
  { id: "q4", text: "What caused the problem, and is it being fixed?", importance: "important", volatility: "medium", why: "The cause tells you whether the problem could come back." },
  { id: "q5", text: "Have the water test results been published?", importance: "important", volatility: "fast", why: "Published results let residents check the decision to lift the advisory." },
  { id: "q6", text: "Where can affected residents get safe water?", importance: "important", volatility: "fast", why: "People still under the advisory need a supply." },
  { id: "q7", text: "Where will official updates be posted?", importance: "optional", volatility: "slow", why: "Knowing where to look avoids relying on forwards." },
];

const CLAIMS: RawClaim[] = [
  { id: "s1c1", sourceId: "s1", subQuestionId: "q1", claim: "The advisory for East Ward and Lakeview Colony was lifted on 28 October 2026.", quote: "was lifted on 28 October 2026 after laboratory tests met drinking water standards", timeReference: "28 October 2026" },
  { id: "s1c2", sourceId: "s1", subQuestionId: "q2", claim: "Only Hill Road remains under the advisory until pipeline repairs are done.", quote: "Hill Road remains under the boil-water advisory until repairs to the damaged main pipeline are completed." },
  { id: "s1c3", sourceId: "s1", subQuestionId: "q3", claim: "Hill Road residents should boil water for at least 1 minute.", quote: "bring drinking water to a rolling boil for at least 1 minute and let it cool before use" },
  { id: "s1c4", sourceId: "s1", subQuestionId: "q6", claim: "Tankers are at the Hill Road community hall, 7 am to 7 pm.", quote: "Water tankers are available at the Hill Road community hall from 7 am to 7 pm." },
  { id: "s1c5", sourceId: "s1", subQuestionId: "q4", claim: "A damaged main pipeline near Hill Road let untreated water in.", quote: "The contamination was caused by a damaged main pipeline near Hill Road, which allowed untreated water to enter the supply." },
  { id: "s1c6", sourceId: "s1", subQuestionId: "q7", claim: "Updates will be posted on the advisory page.", quote: "Further updates will be posted on this page." },
  { id: "s2c1", sourceId: "s2", subQuestionId: "q1", claim: "The advisory was expected to last at least two weeks.", quote: "The advisory is expected to remain in force for at least two weeks", timeReference: "as of 19 October 2026" },
  { id: "s2c2", sourceId: "s2", subQuestionId: "q2", claim: "East Ward and Lakeview Colony residents were asked to boil water.", quote: "asked residents of East Ward and Lakeview Colony to boil drinking water" },
  { id: "s2c3", sourceId: "s2", subQuestionId: "q3", claim: "Boil drinking water for at least 1 minute.", quote: "boil drinking water for at least 1 minute after tests found bacteria in the supply" },
  { id: "s2c4", sourceId: "s2", subQuestionId: "q4", claim: "A damaged pipeline near Hill Road let untreated water in.", quote: "a damaged main pipeline near Hill Road had let untreated water into the network" },
  { id: "s3c1", sourceId: "s3", subQuestionId: "q3", claim: "Boil water for 10 minutes.", quote: "Experts recommend that you boil water for 10 minutes to kill all germs" },
  { id: "s4c1", sourceId: "s4", subQuestionId: "q2", claim: "Hill Road is still under the advisory.", quote: "Hill Road is still under the advisory." },
  { id: "s4c2", sourceId: "s4", subQuestionId: "q6", claim: "Tankers are at the Hill Road community hall.", quote: "Tankers are parked at the Hill Road community hall during the day." },
  { id: "s5c1", sourceId: "s5", subQuestionId: "q1", claim: "Tap water should not be used anywhere in the city until 15 November.", quote: "Do not use tap water even for bathing until 15 November." },
  { id: "s6c1", sourceId: "s6", subQuestionId: "q1", claim: "The advisory is in force for East Ward and Lakeview Colony.", quote: "Riverton's boil-water advisory is currently in force for East Ward and Lakeview Colony." },
  { id: "s6c2", sourceId: "s6", subQuestionId: "q3", claim: "Boil water for 10 minutes.", quote: "Residents should boil water for 10 minutes before drinking." },
];

const RAISED = [
  { sourceId: "s4", question: "Has anyone seen the actual test results?" },
  { sourceId: "s4", question: "Is a chlorine smell after flushing normal?" },
];

// Saved output of the analysis step. It deliberately misses the boiling-time
// disagreement between the official page and the blog: the rule-based number
// check finds it.
const AI: AiFindings = {
  summaries: [
    { subQuestionId: "q1", summary: "The corporation's page, updated 29 October 2026, says the advisory for East Ward and Lakeview Colony was lifted on 28 October [s1c1]. A 19 October news report expected it to last at least two weeks [s2c1], and an undated forwarded message says not to use tap water until 15 November [s5c1]." },
    { subQuestionId: "q2", summary: "The official page says only Hill Road remains under the advisory [s1c2], which a resident also reports [s4c1]; the earlier news report covers East Ward and Lakeview Colony [s2c2]." },
    { subQuestionId: "q3", summary: "The official page and the news report say to bring water to a boil for at least 1 minute [s1c3, s2c3]; a general tips blog gives a longer time [s3c1]." },
    { subQuestionId: "q4", summary: "Both the official page and the news report say a damaged main pipeline near Hill Road let untreated water into the supply [s1c5, s2c4]." },
    { subQuestionId: "q6", summary: "Tankers are available at the Hill Road community hall, according to the official page and a resident [s1c4, s4c2]." },
    { subQuestionId: "q7", summary: "The official page says further updates will be posted there [s1c6]." },
  ],
  conflicts: [
    {
      subQuestionId: "q1",
      claimIds: ["s1c1", "s2c1"],
      summary: "The official page (updated 29 October) says the advisory was lifted on 28 October; the 19 October news report expected it to last at least two weeks.",
      likelyReason: "different-time",
      explanation: "The news report was written the day after the advisory began; the official page was updated after it was lifted.",
      howToResolve: "Rely on the latest official update, and check it again before acting on it.",
      confidence: "high",
    },
    {
      subQuestionId: "q1",
      claimIds: ["s1c1", "s5c1"],
      summary: "The official page says the advisory was lifted on 28 October; an undated forwarded message says not to use tap water until 15 November.",
      likelyReason: "genuine",
      explanation: "The forwarded message has no date or named source and describes a citywide chemical problem that no other source mentions.",
      howToResolve: "Check the corporation's advisory page or helpline before acting on the forward.",
      confidence: "medium",
    },
    {
      subQuestionId: "q2",
      claimIds: ["s1c2", "s2c2"],
      summary: "The 19 October report covers East Ward and Lakeview Colony; the 29 October official page says only Hill Road remains under the advisory.",
      likelyReason: "different-time",
      explanation: "The covered area appears to have shrunk after the advisory was lifted for two areas on 28 October.",
      howToResolve: "Check the official page for the current list of areas.",
      confidence: "high",
    },
    {
      subQuestionId: "q1",
      claimIds: ["s6c1", "s1c1"],
      summary: "The pasted AI answer says the advisory is in force for East Ward and Lakeview Colony; the official page says it was lifted there on 28 October.",
      likelyReason: "different-time",
      explanation: "The AI answer seems to describe the situation before 28 October.",
      howToResolve: "Rely on the latest official update.",
      confidence: "high",
    },
    {
      subQuestionId: "q3",
      claimIds: ["s6c2", "s1c3"],
      summary: "The pasted AI answer says to boil water for 10 minutes; the official page says at least 1 minute.",
      likelyReason: "unclear",
      explanation: "The AI answer gives no source for its figure.",
      howToResolve: "Follow the official advisory's instruction.",
      confidence: "medium",
    },
  ],
  outdated: [
    { sourceId: "s2", claimId: "s2c1", reason: "Expected the advisory to last at least two weeks; the official page says it was lifted after ten days." },
    { sourceId: "s6", claimId: "s6c1", reason: "Describes the advisory as in force for East Ward, which the 29 October official update no longer says." },
  ],
  openQuestions: [
    { question: "Have the water test results been published, and where?", raisedBySourceIds: ["s4"], subQuestionId: "q5" },
    { question: "When are the Hill Road repairs expected to be finished?", raisedBySourceIds: [], subQuestionId: "q4" },
    { question: "Who sent the forwarded message, and what is it based on?", raisedBySourceIds: ["s5"], subQuestionId: "q1" },
  ],
  checklist: [
    {
      priority: "critical",
      task: "Confirm on the corporation's page whether the advisory still applies to your area.",
      whereToVerify: "The Riverton Municipal Corporation advisory page or helpline",
      searchQuery: "Riverton boil water advisory latest update",
      why: "Sources disagree, and a forwarded message says tap water shouldn't be used until 15 November.",
      askSource: "Hello, is the boil-water advisory still in force for my area? A forwarded message says tap water shouldn't be used anywhere in the city until 15 November.",
      relatedIds: ["q1", "s1c1"],
      origin: "conflict",
    },
    {
      priority: "critical",
      task: "Check whether your street is in the area still covered.",
      whereToVerify: "The official advisory page",
      searchQuery: "Riverton Hill Road boil water advisory",
      why: "The covered area changed on 28 October; older reports list areas that are no longer covered.",
      relatedIds: ["q2"],
      origin: "outdated",
    },
    {
      priority: "important",
      task: "Ask where the water test results can be seen.",
      whereToVerify: "The corporation's water supply department",
      searchQuery: "Riverton water test results East Ward",
      why: "The advisory was lifted on test results that no reviewed source shows.",
      askSource: "Hello, could you share the water test results that led to lifting the East Ward advisory on 28 October?",
      relatedIds: ["q5"],
      origin: "gap",
    },
    {
      priority: "optional",
      task: "Check when the Hill Road repairs are expected to finish.",
      whereToVerify: "The official advisory page",
      searchQuery: "Riverton Hill Road pipeline repair",
      why: "Hill Road stays under the advisory until then.",
      relatedIds: ["q4"],
      origin: "open-question",
    },
  ],
};

const EXTRA_SOURCE: RawSource = {
  id: "s7",
  title: "Water quality test report — East Ward and Lakeview Colony",
  site: "Riverton Municipal Corporation (sample)",
  url: "https://riverton-mc.example/water/test-report-oct-2026",
  type: "official",
  text: `Water quality test report — East Ward and Lakeview Colony
Published: 28 October 2026

Samples from 12 points in East Ward and Lakeview Colony were tested on 26 and 27 October 2026. All samples met drinking water standards for bacteria.

Samples from Hill Road did not meet the standard and will be tested again after repairs.`,
};

const EXTRA_CLAIMS: RawClaim[] = [
  { id: "s7c1", sourceId: "s7", subQuestionId: "q5", claim: "Samples from 12 points in East Ward and Lakeview Colony were tested.", quote: "Samples from 12 points in East Ward and Lakeview Colony were tested on 26 and 27 October 2026." },
  { id: "s7c2", sourceId: "s7", subQuestionId: "q5", claim: "All tested samples met bacteria standards.", quote: "All samples met drinking water standards for bacteria." },
  { id: "s7c3", sourceId: "s7", subQuestionId: "q2", claim: "Hill Road samples failed and will be retested after repairs.", quote: "Samples from Hill Road did not meet the standard and will be tested again after repairs." },
];

function withExtra(ai: AiFindings): AiFindings {
  const out: AiFindings = structuredClone(ai);
  out.summaries.push({ subQuestionId: "q5", summary: "An official test report dated 28 October 2026 says samples from 12 points in East Ward and Lakeview Colony met bacteria standards [s7c1, s7c2]." });
  out.openQuestions = out.openQuestions.filter((o) => o.subQuestionId !== "q5");
  out.checklist = out.checklist.map((c) =>
    c.relatedIds.includes("q5")
      ? {
          priority: "optional",
          task: "Read the 28 October test report and check it covers your street.",
          whereToVerify: "The official test report",
          searchQuery: "Riverton water test report October 2026",
          why: "Only one source publishes results, though it is an official report.",
          relatedIds: ["q5", "s7c1"],
          origin: "single-source",
        }
      : c,
  );
  return out;
}

export const RIVERTON: SampleScenario = {
  id: "riverton",
  title: "City water advisory",
  blurb: "A resident checks whether a boil-water advisory still applies: an official update, an older news report, a tips blog, a forum, a forwarded message and a chatbot answer.",
  question: "Is the boil-water advisory in Riverton still in force, and what should residents do?",
  subQuestions: SUBQUESTIONS,
  raw: RAW,
  claims: CLAIMS,
  raised: RAISED,
  ai: AI,
  extra: { source: EXTRA_SOURCE, claims: EXTRA_CLAIMS, topicIds: ["q5"], patch: withExtra },
};
