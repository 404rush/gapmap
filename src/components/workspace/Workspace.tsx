"use client";

// GapMap's five-step workflow. State lives in one session object that is
// saved to this browser, so a reload or a closed tab doesn't lose work.  ﹏𓊝﹏

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, CANCELLED, postForm, postJson } from "@/lib/client/api";
import type { CheckState } from "@/lib/checks";
import { withComparison } from "@/lib/diff";
import { SAMPLE_NOTICE, extraSampleSource, getScenario, runSample, sampleSources } from "@/lib/samples";
import type { Analysis, Claim, Source, SourceRunStatus, SourceType, SubQuestion } from "@/lib/types";
import { cleanTopics } from "@/lib/validate";
import { EvidenceViewer } from "../EvidenceViewer";
import { EvidenceContext, STATUS, SampleTag, tagOf } from "../ui";
import { Header, type Health } from "./Header";
import { PlanStep } from "./PlanStep";
import { QuestionStep } from "./QuestionStep";
import { Results } from "./Results";
import {
  type ExtractResult,
  type HistoryEntry,
  type ItemOrigin,
  type Mode,
  type RetryInfo,
  type SessionData,
  type Step,
  type StoredItem,
  deleteFromHistory,
  exportSession,
  extractKey,
  hasContent,
  importSession,
  inputsKey,
  listHistory,
  loadCurrent,
  loadFromHistory,
  newSession,
  planKey,
  saveCurrent,
  saveToHistory,
} from "./session";
import { type Progress, type SearchHit, type SearchState, SourcesStep } from "./SourcesStep";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** setTimeout as a promise that stops early when the run is cancelled. */
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError(CANCELLED, 499));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new ApiError(CANCELLED, 499))), { once: true });
  });

const normUrl = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "").toLowerCase()}${x.pathname.replace(/\/+$/, "")}${x.search}`;
  } catch {
    return u.trim().toLowerCase();
  }
};

const readyItem = (src: Source, origin: ItemOrigin = "sample"): StoredItem => ({ id: src.id, status: "ready", label: src.title, origin, source: src });

function startSession(mode: Mode, scenarioId?: string): SessionData {
  const s = newSession(mode, scenarioId);
  if (mode === "sample") {
    const sc = getScenario(scenarioId);
    s.scenarioId = sc.id;
    s.question = sc.question;
  }
  return s;
}

export default function Workspace() {
  const [s, setS] = useState<SessionData>(() => newSession("live"));
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ sourceId: string; claimId?: string } | null>(null);
  const [search, setSearch] = useState<SearchState>({ query: "", results: [], loading: false, error: null });
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(1);
  const historySaved = useRef<string | undefined>(undefined);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Restore the last session, and check which keys the server has
  useEffect(() => {
    let alive = true;
    Promise.all([loadCurrent(), listHistory()])
      .then(([cur, hist]) => {
        if (!alive) return;
        if (cur) {
          idRef.current = cur.nextId;
          historySaved.current = cur.analysis?.generatedAt;
          setS(cur);
        }
        setHistory(hist);
      })
      .finally(() => alive && setHydrated(true));
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: Health) => alive && setHealth(h))
      .catch(() => alive && setHealth({ ai: null, search: false }));
    return () => {
      alive = false;
    };
  }, []);

  // Save (debounced), and keep each new analysis in Recent
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      void saveCurrent(s);
      const gen = s.analysis?.generatedAt;
      if (gen && historySaved.current !== gen) {
        historySaved.current = gen;
        void saveToHistory(s).then(setHistory);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [s, hydrated]);

  const update = useCallback((patch: Partial<SessionData> | ((prev: SessionData) => Partial<SessionData>)) => {
    setS((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch), updatedAt: new Date().toISOString() }));
  }, []);
  const setItems = (fn: (items: StoredItem[]) => StoredItem[]) => update((prev) => ({ items: fn(prev.items) }));

  const flash = (text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  };

  const scrollTo = (anchor?: string) =>
    requestAnimationFrame(() => {
      const el = anchor ? document.getElementById(anchor) : null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });

  const goTo = (step: Step, anchor?: string) => {
    update({ step });
    scrollTo(anchor);
  };

  const replaceSession = (next: SessionData) => {
    abortRef.current?.abort();
    idRef.current = next.nextId;
    historySaved.current = next.analysis?.generatedAt;
    setS(next);
    setPlanError(null);
    setRunError(null);
    setProgress(null);
    setEvidence(null);
    setSearch({ query: "", results: [], loading: false, error: null });
    scrollTo();
  };

  /** Park the current work in Recent, then switch. */
  const switchTo = async (next: SessionData | Promise<SessionData | undefined>) => {
    if (hasContent(s)) setHistory(await saveToHistory(s));
    const n = await next;
    if (n) replaceSession(n);
  };

  const startNew = (mode: Mode = s.mode, scenarioId?: string) => switchTo(startSession(mode, scenarioId ?? s.scenarioId));
  const onMode = (m: Mode) => {
    if (m !== s.mode) void startNew(m);
  };
  const pickScenario = (id: string) => {
    if (id === s.scenarioId) return;
    if (s.subQuestions.length || s.items.length) void startNew("sample", id);
    else update({ scenarioId: id, question: getScenario(id).question });
  };

  // Step 1 to 2: plan the coverage
  const planReady = s.subQuestions.length > 0 && s.plannedFor === s.question.trim();
  const plan = async () => {
    if (planReady) return goTo(2);
    setPlanError(null);
    setPlanning(true);
    try {
      if (s.mode === "sample") {
        await wait(500);
        const sc = getScenario(s.scenarioId);
        update({ subQuestions: sc.subQuestions.map((q) => ({ ...q })), plannedFor: sc.question.trim(), planModel: "Saved sample plan", step: 2 });
      } else {
        const r = await postJson<{ subQuestions: SubQuestion[]; model?: string }>("/api/plan", { question: s.question });
        update({ subQuestions: r.subQuestions, plannedFor: s.question.trim(), planModel: r.model, step: 2 });
      }
      scrollTo();
    } catch (e) {
      setPlanError(errMsg(e));
    } finally {
      setPlanning(false);
    }
  };

  // Step 3: sources
  const enterSources = () => {
    const subQuestions = cleanTopics(s.subQuestions);
    if (s.mode === "sample" && s.items.length === 0) {
      const srcs = sampleSources(getScenario(s.scenarioId));
      idRef.current = Math.max(idRef.current, srcs.length + 1);
      update({ subQuestions, items: srcs.map((x) => readyItem(x)), nextId: idRef.current, step: 3 });
    } else update({ subQuestions, step: 3 });
    scrollTo();
  };

  const load = async (id: string, loader: (id: string) => Promise<Source>) => {
    try {
      const source = await loader(id);
      setItems((items) => items.map((it) => (it.id === id ? { ...it, status: "ready", source, label: source.title, error: undefined } : it)));
    } catch (e) {
      setItems((items) => items.map((it) => (it.id === id ? { ...it, status: "error", error: errMsg(e) } : it)));
    }
  };

  const addItem = (label: string, origin: ItemOrigin, loader: (id: string) => Promise<Source>, retry?: RetryInfo) => {
    const n = Math.max(idRef.current, s.nextId);
    idRef.current = n + 1;
    const id = `s${n}`;
    update((prev) => ({ items: [...prev.items, { id, status: "loading", label, origin, retry }], nextId: Math.max(prev.nextId, n + 1) }));
    void load(id, loader);
  };

  const linkLoader = (r: RetryInfo) => (id: string) => postJson<{ source: Source }>("/api/source", { id, ...r }).then((x) => x.source);

  const addLink = (url: string, fallback?: Omit<RetryInfo, "url">): string | null => {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return "Only http and https links can be added.";
    } catch {
      return "That doesn't look like a web address.";
    }
    const key = normUrl(url);
    const dup = s.items.find((it) => it.status !== "error" && normUrl(it.retry?.url ?? it.source?.url ?? "") === key);
    if (dup) return `Already added as ${tagOf(dup.id)}.`;
    const retry: RetryInfo = { url, ...fallback };
    addItem(fallback?.fallbackTitle || url, fallback ? "search" : "link", linkLoader(retry), retry);
    return null;
  };

  const retryItem = (id: string) => {
    const it = s.items.find((x) => x.id === id);
    if (!it?.retry) return;
    setItems((items) => items.map((x) => (x.id === id ? { ...x, status: "loading", error: undefined } : x)));
    void load(id, linkLoader(it.retry));
  };

  const addText = (b: { title: string; text: string; url?: string; date?: string }, isAi: boolean) =>
    addItem(b.title || (isAi ? "AI chatbot answer" : "Pasted text"), isAi ? "ai" : "paste", (id) =>
      postJson<{ source: Source }>("/api/source", { id, ...b, isAiAnswer: isAi }).then((x) => x.source),
    );

  const addPdf = (file: File) =>
    addItem(file.name, "pdf", (id) => {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("file", file);
      return postForm<{ source: Source }>("/api/source", fd).then((x) => x.source);
    });

  const removeItem = (id: string) => setItems((items) => items.filter((x) => x.id !== id));

  const editItem = (id: string, patch: { sourceType?: SourceType; publishedDate?: string | null }) =>
    setItems((items) =>
      items.map((it) => {
        if (it.id !== id || !it.source) return it;
        const src: Source = { ...it.source, userEdited: { ...it.source.userEdited } };
        if (patch.sourceType) {
          src.sourceType = patch.sourceType;
          src.userEdited!.type = true;
        }
        if (patch.publishedDate !== undefined) {
          src.userEdited!.date = true;
          if (patch.publishedDate === null) Object.assign(src, { publishedDate: undefined, dateLabel: undefined, dateEvidence: "Date removed by you", dateConfidence: "none" });
          else Object.assign(src, { publishedDate: patch.publishedDate, dateLabel: "Dated", dateEvidence: "Set by you", dateConfidence: "found" });
        }
        return { ...it, source: src };
      }),
    );

  const scenario = s.mode === "sample" ? getScenario(s.scenarioId) : undefined;

  const addExtraSample = () => {
    const extra = scenario && extraSampleSource(scenario);
    if (!extra || s.items.some((i) => i.id === extra.id)) return;
    setItems((items) => [...items, readyItem(extra)]);
    flash(`Added ${tagOf(extra.id)}: ${extra.title}. Re-run to see what changes.`);
  };

  const restoreSamples = () => {
    if (!scenario) return;
    const all = sampleSources(scenario);
    setItems((items) => {
      const have = new Map(items.map((i) => [i.id, i]));
      return [...all.map((src) => have.get(src.id) ?? readyItem(src)), ...items.filter((i) => !all.some((x) => x.id === i.id))];
    });
  };

  const runSearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearch((p) => ({ ...p, query: q, loading: true, error: null }));
    try {
      const r = await postJson<{ results: SearchHit[] }>("/api/search", { query: q });
      setSearch({ query: q, results: r.results, loading: false, error: r.results.length ? null : "No results. Try different words." });
    } catch (e) {
      setSearch((p) => ({ ...p, loading: false, error: errMsg(e) }));
    }
  };

  /** Close the loop: from a gap or checklist item back to adding a source for that topic. */
  const findSource = (topicId: string) => {
    const topic = s.subQuestions.find((q) => q.id === topicId);
    if (!topic) return;
    const item = s.analysis?.checklist.find((c) => c.topicIds.includes(topicId) && c.searchQuery);
    const query = (item?.searchQuery || `${topic.text} ${s.question}`).slice(0, 300);
    update({ verifyTarget: topicId, step: 3 });
    if (s.mode === "live" && health?.search) void runSearch(query);
    else setSearch((p) => ({ ...p, query }));
    scrollTo();
  };

  // Step 3 to 4: run the analysis
  const readySources = useMemo(() => s.items.filter((i) => i.status === "ready" && i.source).map((i) => i.source!), [s.items]);
  const currentInputs = useMemo(() => inputsKey(s.question, cleanTopics(s.subQuestions), readySources), [s.question, s.subQuestions, readySources]);
  const stale = !!s.analysis?.inputsKey && s.analysis.inputsKey !== currentInputs;

  const run = async () => {
    const sess = s;
    const subQuestions = cleanTopics(sess.subQuestions);
    const ready = readySources;
    if (ready.length < 2 || subQuestions.length < 2) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const { signal } = ctl;
    setRunError(null);
    const total = ready.length;
    setProgress({ phase: 1, done: 0, total, notes: [] });
    try {
      let analysis: Analysis;
      let cache = sess.extractCache;
      if (sess.mode === "sample") {
        for (let i = 1; i <= total; i++) {
          await wait(220, signal);
          setProgress((p) => p && { ...p, done: i });
        }
        await wait(450, signal);
        setProgress((p) => p && { ...p, phase: 2 });
        await wait(500, signal);
        setProgress((p) => p && { ...p, phase: 3 });
        await wait(300, signal);
        analysis = runSample(getScenario(sess.scenarioId), ready);
      } else {
        const pk = planKey(sess.question, subQuestions);
        const claims: Claim[] = [];
        const raised: { sourceId: string; question: string }[] = [];
        const notes: string[] = [];
        const status: Record<string, SourceRunStatus> = {};
        const nextCache: Record<string, ExtractResult> = {};
        let done = 0;
        const queue = [...ready];
        const worker = async () => {
          while (queue.length && !signal.aborted) {
            const src = queue.shift()!;
            const key = extractKey(src, pk);
            try {
              let r = sess.extractCache[key];
              const cached = !!r;
              if (!r) {
                const out = await postJson<{ claims: Claim[]; raisedQuestions: string[]; excerpted: boolean }>(
                  "/api/extract",
                  { question: sess.question, subQuestions, source: src },
                  signal,
                );
                r = { claims: out.claims, raised: out.raisedQuestions, excerpted: out.excerpted };
              }
              nextCache[key] = r;
              claims.push(...r.claims);
              raised.push(...r.raised.map((q) => ({ sourceId: src.id, question: q })));
              status[src.id] = { status: r.claims.length ? "ok" : "no-claims", excerpted: r.excerpted || undefined, cached: cached || undefined };
              const bad = r.claims.filter((c) => !c.verified).length;
              if (cached) notes.push(`${tagOf(src.id)}: unchanged since the last run, so the earlier extraction was reused.`);
              if (bad) notes.push(`${tagOf(src.id)}: ${bad} quote${bad > 1 ? "s" : ""} not found on the page, so marked uncertain.`);
            } catch (e) {
              if (signal.aborted) return;
              status[src.id] = { status: "failed", error: errMsg(e) };
              notes.push(`${tagOf(src.id)} couldn't be analysed: ${errMsg(e)}`);
            }
            done++;
            setProgress({ phase: 1, done, total, notes: [...notes] });
          }
        };
        await Promise.all([worker(), worker()]);
        if (signal.aborted) throw new ApiError(CANCELLED, 499);
        if (!claims.length) {
          const failed = Object.values(status).filter((x) => x.status === "failed");
          throw new Error(
            failed.length === ready.length
              ? `None of the sources could be analysed. ${failed[0]?.error ?? ""}`.trim()
              : "Nothing in these sources answered the planned topics. Try sources that address the question more directly.",
          );
        }
        setProgress((p) => p && { ...p, phase: 2 });
        const res = await postJson<{ analysis: Analysis }>(
          "/api/analyze",
          { question: sess.question, subQuestions, sources: ready, claims, raisedQuestions: raised, sourceStatus: status },
          signal,
        );
        analysis = res.analysis;
        cache = nextCache;
        setProgress((p) => p && { ...p, phase: 3 });
        await wait(200, signal);
      }
      const prev = sess.analysis;
      const next = withComparison(prev, { ...analysis, inputsKey: inputsKey(sess.question, subQuestions, ready) });
      update({ analysis: next, previous: prev, extractCache: cache, subQuestions, verifyTarget: undefined, step: 4 });
      scrollTo();
    } catch (e) {
      if (signal.aborted || (e instanceof ApiError && e.message === CANCELLED)) flash("Analysis cancelled. Your sources are still here.");
      else setRunError(errMsg(e));
    } finally {
      setProgress(null);
      if (abortRef.current === ctl) abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const setCheck = (key: string, v: CheckState) => update((prev) => ({ checks: { ...prev.checks, [key]: v } }));

  const exportJson = () => {
    const url = URL.createObjectURL(exportSession(s));
    const el = document.createElement("a");
    el.href = url;
    el.download = `gapmap-${(s.question || "analysis").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "")}.json`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importJson = async (file: File) => {
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("That file is too large.");
      const next = importSession(await file.text());
      await switchTo(next);
      flash("Opened the saved analysis.");
    } catch (e) {
      flash(errMsg(e));
    }
  };

  // Evidence lookup for every view
  const fullSourceById = useMemo(() => new Map(s.items.filter((i) => i.source).map((i) => [i.id, i.source!])), [s.items]);
  const analysis = s.analysis;
  const evidenceApi = useMemo(
    () => ({
      openClaim: (claimId: string) => {
        const c = analysis?.claims.find((x) => x.id === claimId);
        if (c) setEvidence({ sourceId: c.sourceId, claimId });
      },
      openSource: (sourceId: string) => setEvidence({ sourceId }),
      claimById: new Map((analysis?.claims ?? []).map((c) => [c.id, c])),
      sourceById: new Map((analysis?.sources ?? []).map((x) => [x.id, x])),
    }),
    [analysis],
  );
  const closeEvidence = useCallback(() => setEvidence(null), []);

  const evSource = evidence ? fullSourceById.get(evidence.sourceId) : undefined;
  const evClaim = evidence?.claimId ? analysis?.claims.find((c) => c.id === evidence.claimId) : undefined;
  const liveBlocked = s.mode === "live" && health !== null && !health.ai;
  const targetIdx = s.verifyTarget ? s.subQuestions.findIndex((q) => q.id === s.verifyTarget) : -1;
  const targetResult = analysis?.results.find((r) => r.subQuestionId === s.verifyTarget);
  const extra = scenario?.extra;
  const canAddExtra = !!extra && !s.items.some((i) => i.id === extra.source.id);

  return (
    <EvidenceContext.Provider value={evidenceApi}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header
        mode={s.mode}
        health={health}
        step={s.step}
        hasPlan={s.subQuestions.length > 0}
        hasAnalysis={!!analysis}
        onStep={(step, anchor) => (step === 3 ? enterSources() : goTo(step, anchor))}
        onNew={() => void startNew()}
        onMode={onMode}
      />

      <main id="main" className={`mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 transition-opacity duration-200 sm:px-6 ${hydrated ? "opacity-100" : "opacity-0"}`} aria-busy={!hydrated}>
        {s.mode === "sample" && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-ink bg-mark/60 px-4 py-2.5 text-[13.5px]">
            <SampleTag />
            <span className="min-w-0 flex-1 basis-[280px]">
              {SAMPLE_NOTICE} The AI steps replay saved outputs; dates, quote checks, copy and number checks, statuses and the checklist rules are computed live.
            </span>
          </div>
        )}

        {s.step === 1 && (
          <QuestionStep
            mode={s.mode}
            scenarioId={s.scenarioId}
            question={s.question}
            setQuestion={(question) => update({ question })}
            onPickScenario={pickScenario}
            onPlan={plan}
            planning={planning}
            error={planError}
            liveBlocked={liveBlocked}
            onSample={() => onMode("sample")}
            history={history}
            onOpenHistory={(id) => void switchTo(loadFromHistory(id))}
            onDeleteHistory={(id) => void deleteFromHistory(id).then(setHistory)}
            onImport={importJson}
            currentId={s.id}
            planReady={planReady}
          />
        )}
        {s.step === 2 && (
          <PlanStep
            mode={s.mode}
            question={s.question}
            subQuestions={s.subQuestions}
            setSubQuestions={(subQuestions) => update({ subQuestions })}
            hasAnalysis={!!analysis}
            model={s.planModel}
            onBack={() => goTo(1)}
            onNext={enterSources}
          />
        )}
        {s.step === 3 && (
          <SourcesStep
            mode={s.mode}
            scenario={scenario}
            question={s.question}
            items={s.items}
            health={health}
            addLink={addLink}
            addText={addText}
            addPdf={addPdf}
            retryItem={retryItem}
            removeItem={removeItem}
            editItem={editItem}
            addExtraSample={addExtraSample}
            restoreSamples={restoreSamples}
            search={search}
            setSearchQuery={(query) => setSearch((p) => ({ ...p, query }))}
            runSearch={(q) => void runSearch(q)}
            target={
              targetIdx >= 0
                ? { id: s.verifyTarget!, index: targetIdx, text: s.subQuestions[targetIdx].text, status: targetResult && STATUS[targetResult.status].short, query: search.query }
                : undefined
            }
            clearTarget={() => update({ verifyTarget: undefined })}
            onBack={() => goTo(2)}
            onRun={run}
            onCancel={cancel}
            progress={progress}
            runError={runError}
            onRead={(id) => setEvidence({ sourceId: id })}
            hasAnalysis={!!analysis}
            stale={stale}
            onViewResults={() => goTo(4)}
          />
        )}
        {s.step === 4 && analysis && (
          <Results
            a={analysis}
            checks={s.checks}
            setCheck={setCheck}
            onFindSource={findSource}
            onEditSources={enterSources}
            onExport={exportJson}
            stale={stale}
            onRerun={() => {
              enterSources();
              void run();
            }}
            canAddExtra={canAddExtra}
          />
        )}
        {s.step === 4 && !analysis && (
          <p className="py-16 text-center text-[15px] text-ink-2">
            No analysis yet.{" "}
            <button type="button" className="font-semibold text-ai underline" onClick={enterSources}>
              Add sources and run one
            </button>
            .
          </p>
        )}
      </main>

      <footer className="no-print border-t border-rule bg-sheet">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12.5px] text-ink-2 sm:px-6">
          <p>GapMap highlights signals, not verdicts. Always confirm important details with the original source. Your work is saved in this browser only.</p>
          <p title="sign of creation">
            Built by Arush Giri{" "}
            <span className="sign" aria-hidden>
              ﹏𓊝﹏
            </span>
          </p>
        </div>
      </footer>

      {notice && (
        <div role="status" className="no-print fixed bottom-4 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-[14px] text-white shadow-xl">
          {notice}
        </div>
      )}

      {evidence && evSource && (
        <EvidenceViewer source={evSource} claim={evClaim} now={new Date(analysis?.generatedAt ?? evSource.fetchedAt)} onClose={closeEvidence} />
      )}
    </EvidenceContext.Provider>
  );
}
