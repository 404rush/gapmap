"use client";

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Crosshair,
  FileText,
  FileUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  ScanSearch,
  Search,
  TextCursorInput,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { SampleScenario } from "@/lib/samples";
import { EDITABLE_TYPES, SOURCE_TYPE_LABEL, classifySource } from "@/lib/sourceType";
import type { Source, SourceType } from "@/lib/types";
import { SampleTag, SectionHead, SourceDate, TabList, TabPanel, TypeTag, btn, tagOf, useIdBase } from "../ui";
import type { Health } from "./Header";
import type { Mode, RetryInfo, StoredItem } from "./session";

export const MAX_SOURCES = 8;

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  content?: string;
}
export interface SearchState {
  query: string;
  results: SearchHit[];
  loading: boolean;
  error: string | null;
}
export interface Progress {
  phase: 1 | 2 | 3;
  done: number;
  total: number;
  notes: string[];
}
export interface VerifyTarget {
  id: string;
  index: number;
  text: string;
  status?: string;
  query: string;
}

type AddTab = "link" | "search" | "paste" | "pdf" | "ai";

interface Props {
  mode: Mode;
  scenario?: SampleScenario;
  question: string;
  items: StoredItem[];
  health: Health | null;
  addLink: (url: string, retry?: Omit<RetryInfo, "url">) => string | null;
  addText: (b: { title: string; text: string; url?: string; date?: string }, isAi: boolean) => void;
  addPdf: (file: File) => void;
  retryItem: (id: string) => void;
  removeItem: (id: string) => void;
  editItem: (id: string, patch: { sourceType?: SourceType; publishedDate?: string | null }) => void;
  addExtraSample: () => void;
  restoreSamples: () => void;
  search: SearchState;
  setSearchQuery: (q: string) => void;
  runSearch: (q: string) => void;
  target?: VerifyTarget;
  clearTarget: () => void;
  onBack: () => void;
  onRun: () => void;
  onCancel: () => void;
  progress: Progress | null;
  runError: string | null;
  onRead: (id: string) => void;
  hasAnalysis: boolean;
  stale: boolean;
  onViewResults: () => void;
}

export function SourcesStep(props: Props) {
  const { mode, items, health, progress, target } = props;
  const idBase = useIdBase("add");
  const [tab, setTab] = useState<AddTab>(() => (target && health?.search ? "search" : "link"));
  const [pastePrefill, setPastePrefill] = useState<{ url: string; title: string; n: number } | null>(null);
  const ready = items.filter((i) => i.status === "ready");
  const loading = items.some((i) => i.status === "loading");
  const full = items.filter((i) => i.status !== "error").length >= MAX_SOURCES;
  const busy = !!progress;
  const extra = props.scenario?.extra;
  const extraAdded = !!extra && items.some((i) => i.id === extra.source.id);
  const removedSamples = mode === "sample" && props.scenario ? props.scenario.raw.filter((r) => !items.some((i) => i.id === r.id)).length : 0;
  const seconds = Math.max(20, Math.ceil(ready.length / 2) * 12 + 15);

  const tabs: { id: AddTab; label: string; icon: ReactNode }[] = [
    { id: "link", label: "Link", icon: <Link2 size={15} aria-hidden /> },
    { id: "search", label: "Search the web", icon: <Search size={15} aria-hidden /> },
    { id: "paste", label: "Paste text", icon: <TextCursorInput size={15} aria-hidden /> },
    { id: "pdf", label: "PDF", icon: <FileUp size={15} aria-hidden /> },
    { id: "ai", label: "AI answer", icon: <Bot size={15} aria-hidden /> },
  ];

  return (
    <section>
      <SectionHead step={3} title="Sources" />
      <p className="max-w-[70ch] text-[15px] text-ink-2">
        Add 2 to {MAX_SOURCES} sources. Mixing official pages, news, blogs and forums gives the clearest picture of where they agree and where they don&rsquo;t.
      </p>

      {target && (
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-md border-2 border-ai bg-[color-mix(in_srgb,var(--ai)_6%,white)] p-3.5" role="status">
          <Crosshair size={18} aria-hidden className="mt-0.5 shrink-0 text-ai" />
          <div className="min-w-0 flex-1 basis-[260px] text-[14px]">
            <p>
              <span className="font-bold">Looking for a source on topic {target.index + 1}:</span> {target.text}
              {target.status && <span className="text-ink-3"> (now: {target.status})</span>}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-2">
              {mode === "sample"
                ? extra && !extraAdded
                  ? "The sample includes one more source. Add it below, then re-run to see what changes."
                  : "Re-run the analysis to see what changed."
                : health?.search
                  ? "Search results for it are below. Add one that answers it, then re-run."
                  : "Add a link, PDF or pasted text that answers it, then re-run."}
            </p>
          </div>
          <button type="button" onClick={props.clearTarget} className={btn.ghost} aria-label="Dismiss">
            <X size={15} aria-hidden /> Dismiss
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          {mode === "live" ? (
            <div className="rounded-lg border-2 border-ink bg-sheet">
              <TabList
                tabs={tabs}
                value={tab}
                onChange={setTab}
                label="Ways to add a source"
                idBase={idBase}
                className="flex flex-wrap gap-1 border-b border-rule p-1.5"
                tabClass={(on) => `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13.5px] font-semibold ${on ? "bg-ink text-white" : "text-ink-2 hover:bg-rule-soft"}`}
              />
              <TabPanel idBase={idBase} active={tab} className="p-4">
                {full ? (
                  <p className="text-[14px] text-ink-2">You&rsquo;ve added the maximum of {MAX_SOURCES} sources. Remove one to add another.</p>
                ) : (
                  <>
                    {tab === "link" && <LinkForm onAdd={(url) => props.addLink(url)} />}
                    {tab === "search" && (
                      <SearchPanel
                        enabled={!!health?.search}
                        search={props.search}
                        setQuery={props.setSearchQuery}
                        run={props.runSearch}
                        items={items}
                        onAdd={(hit) => props.addLink(hit.url, { fallbackText: hit.content, fallbackTitle: hit.title, fallbackDate: hit.publishedDate })}
                      />
                    )}
                    {tab === "paste" && (
                      <PasteForm
                        key={pastePrefill?.n ?? 0}
                        isAi={false}
                        initialUrl={pastePrefill?.url}
                        initialTitle={pastePrefill?.title}
                        onAdd={(b) => {
                          props.addText(b, false);
                          setPastePrefill(null);
                        }}
                      />
                    )}
                    {tab === "ai" && <PasteForm isAi onAdd={(b) => props.addText(b, true)} />}
                    {tab === "pdf" && <PdfForm onAdd={props.addPdf} />}
                  </>
                )}
              </TabPanel>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-ink bg-sheet p-4 text-[14px]">
              <p className="font-bold">Sample demo: {props.scenario?.title}</p>
              <p className="mt-1 text-ink-2">{props.scenario?.blurb}</p>
              <p className="mt-2 text-[13px] text-ink-3">
                You can remove sources and re-run. Quote checks, dates, copy and number checks and statuses are all recomputed live. Switch to{" "}
                <span className="font-semibold">Live sources</span> in the header to analyse real pages.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {extra && !extraAdded && (
                  <button type="button" onClick={props.addExtraSample} className={btn.secondary} disabled={busy}>
                    <Plus size={15} aria-hidden /> Add a newer source: {extra.source.title}
                  </button>
                )}
                {removedSamples > 0 && (
                  <button type="button" onClick={props.restoreSamples} className={btn.ghost} disabled={busy}>
                    <RotateCcw size={14} aria-hidden /> Restore removed sources ({removedSamples})
                  </button>
                )}
              </div>
            </div>
          )}

          {props.runError && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-[color-mix(in_srgb,var(--contested)_10%,white)] p-3 text-[14px] text-contested">
              <AlertTriangle size={17} aria-hidden className="mt-0.5 shrink-0" /> {props.runError}
            </p>
          )}

          {progress ? (
            <RunProgress p={progress} onCancel={props.onCancel} />
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={props.onBack} className={btn.secondary}>
                Back
              </button>
              <button type="button" onClick={props.onRun} disabled={ready.length < 2 || loading} className={btn.primary}>
                <ScanSearch size={16} aria-hidden /> {props.hasAnalysis ? "Re-run analysis" : "Analyse"} ({ready.length} source{ready.length === 1 ? "" : "s"})
              </button>
              {props.hasAnalysis && (
                <button type="button" onClick={props.onViewResults} className={btn.ghost}>
                  {props.stale ? "View previous findings" : "View findings"}
                </button>
              )}
              <span className="text-[13px] text-ink-3">
                {ready.length < 2 ? "Add at least two sources." : loading ? "Waiting for sources to finish loading…" : mode === "live" ? `Usually takes about ${seconds} seconds.` : ""}
              </span>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-bold">
            Added ({items.filter((i) => i.status !== "error").length}/{MAX_SOURCES})
          </p>
          {items.length === 0 && (
            <p className="rounded-md border-2 border-dashed border-rule p-6 text-center text-[14px] text-ink-3">No sources yet. Add a link, search, paste text or upload a PDF.</p>
          )}
          <ul className="space-y-2">
            {items.map((it) => (
              <ItemRow
                key={it.id}
                it={it}
                mode={mode}
                busy={busy}
                onRead={() => props.onRead(it.id)}
                onRemove={() => props.removeItem(it.id)}
                onRetry={() => props.retryItem(it.id)}
                onEdit={(p) => props.editItem(it.id, p)}
                onPasteInstead={() => {
                  setPastePrefill({ url: it.retry?.url ?? "", title: it.retry?.fallbackTitle ?? "", n: Date.now() });
                  setTab("paste");
                  props.removeItem(it.id);
                }}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ItemRow({
  it,
  mode,
  busy,
  onRead,
  onRemove,
  onRetry,
  onEdit,
  onPasteInstead,
}: {
  it: StoredItem;
  mode: Mode;
  busy: boolean;
  onRead: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onEdit: (p: { sourceType?: SourceType; publishedDate?: string | null }) => void;
  onPasteInstead: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const s = it.source;
  return (
    <li className={`rounded-md border bg-white p-3 ${it.status === "error" ? "border-contested" : "border-rule"}`}>
      <div className="flex items-start gap-2.5">
        <span className="display mt-0.5 w-7 shrink-0 text-[18px]">{tagOf(it.id)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold" title={s?.title ?? it.label}>
            {s?.title ?? it.label}
          </p>
          {it.status === "loading" && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <Loader2 size={13} aria-hidden className="animate-spin" /> {it.origin === "pdf" ? "Reading the PDF…" : "Reading the page and looking for its date…"}
            </p>
          )}
          {it.status === "error" && (
            <>
              <p className="mt-0.5 text-[12.5px] text-contested">{it.error}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {it.retry && (
                  <button type="button" onClick={onRetry} className={btn.link}>
                    <RotateCcw size={13} aria-hidden /> Try again
                  </button>
                )}
                {it.retry?.url && mode === "live" && (
                  <button type="button" onClick={onPasteInstead} className={btn.link}>
                    <TextCursorInput size={13} aria-hidden /> Paste its text instead
                  </button>
                )}
              </div>
            </>
          )}
          {s && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-2">
              <TypeTag type={s.sourceType} />
              {s.isSample && <SampleTag />}
              <span className="max-w-[160px] truncate">{s.site}</span>
              <SourceDate s={s} />
              {s.userEdited?.type && <span className="text-ink-3">(type set by you)</span>}
            </div>
          )}
          {s?.via === "search-service" && <p className="mt-1 text-[12px] text-ink-3">The site blocked direct reading, so the search service&rsquo;s copy is used.</p>}
          {s && editing && (
            <EditSource
              s={s}
              onSave={(p) => {
                onEdit(p);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center">
          {s && (
            <button type="button" onClick={onRead} className="rounded p-1.5 text-ink-2 hover:bg-rule-soft" aria-label={`Read the text of ${tagOf(it.id)}`} title="Read source text">
              <FileText size={15} aria-hidden />
            </button>
          )}
          {s && mode === "live" && s.sourceType !== "ai-answer" && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="rounded p-1.5 text-ink-2 hover:bg-rule-soft"
              aria-label={`Correct the type or date of ${tagOf(it.id)}`}
              title="Correct type or date"
            >
              <Pencil size={15} aria-hidden />
            </button>
          )}
          {it.status !== "loading" && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="rounded p-1.5 text-ink-3 hover:bg-rule-soft hover:text-contested"
              aria-label={`Remove ${tagOf(it.id)}`}
              title="Remove"
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function EditSource({ s, onSave, onCancel }: { s: Source; onSave: (p: { sourceType?: SourceType; publishedDate?: string | null }) => void; onCancel: () => void }) {
  const [type, setType] = useState<SourceType>(s.sourceType);
  const [date, setDate] = useState(s.publishedDate ?? "");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mt-2 rounded-md border border-rule bg-sheet p-2.5">
      <p className="text-[12px] text-ink-3">Detected automatically. If it&rsquo;s wrong, correct it here and the results will mark the change.</p>
      <div className="mt-1.5 flex flex-wrap items-end gap-2">
        <label className="text-[12px] font-semibold">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as SourceType)} className="mt-0.5 block rounded border border-rule bg-white px-2 py-1 text-[13px]">
            {EDITABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SOURCE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold">
          Published or updated
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="mt-0.5 block rounded border border-rule bg-white px-2 py-1 text-[13px]" />
        </label>
        <button
          type="button"
          className={btn.primary + " !px-3 !py-1.5"}
          onClick={() =>
            onSave({
              sourceType: type !== s.sourceType ? type : undefined,
              publishedDate: date !== (s.publishedDate ?? "") ? date || null : undefined,
            })
          }
        >
          Save
        </button>
        <button type="button" className={btn.ghost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function RunProgress({ p, onCancel }: { p: Progress; onCancel: () => void }) {
  const phases = [
    `Extracting claims and checking every quote against its page (${p.done}/${p.total})`,
    "Comparing sources for conflicts, outdated details and gaps",
    "Building your checklist",
  ];
  return (
    <div className="mt-6 rounded-lg border border-ink bg-white p-4" role="status" aria-live="polite">
      <ol className="space-y-2">
        {phases.map((t, i) => {
          const n = i + 1;
          const state = p.phase > n ? "done" : p.phase === n ? "doing" : "todo";
          return (
            <li key={i} className={`flex items-center gap-2.5 text-[14px] ${state === "todo" ? "text-ink-3" : "text-ink"}`}>
              {state === "done" ? (
                <Check size={16} aria-hidden className="text-covered" />
              ) : state === "doing" ? (
                <Loader2 size={16} aria-hidden className="animate-spin" />
              ) : (
                <span aria-hidden className="h-4 w-4 rounded-full border border-rule" />
              )}
              {t}
              <span className="sr-only">{state === "done" ? "(done)" : state === "doing" ? "(in progress)" : ""}</span>
            </li>
          );
        })}
      </ol>
      {p.notes.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-rule pt-2 text-[12.5px] text-ink-2">
          {p.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onCancel} className={`${btn.ghost} mt-3 border border-rule`}>
        <X size={14} aria-hidden /> Cancel
      </button>
    </div>
  );
}

function LinkForm({ onAdd }: { onAdd: (url: string) => string | null }) {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const submit = () => {
    const u = url.trim();
    if (!u) return;
    const err = onAdd(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    setMsg(err);
    if (!err) setUrl("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="url" className="text-[13.5px] font-semibold">
        Page or PDF link
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setMsg(null);
          }}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-md border border-rule bg-white px-3 py-2 text-[15px] focus:border-ink focus:outline-none"
        />
        <button type="submit" className={btn.primary} disabled={!url.trim()}>
          Add
        </button>
      </div>
      {msg && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-contested">
          {msg}
        </p>
      )}
      <p className="mt-2 text-[12.5px] text-ink-3">
        GapMap reads the page text and looks for its publish or update date. It respects robots.txt; if a site blocks reading, paste the text instead.
      </p>
    </form>
  );
}

function SearchPanel({
  enabled,
  search,
  setQuery,
  run,
  items,
  onAdd,
}: {
  enabled: boolean;
  search: SearchState;
  setQuery: (q: string) => void;
  run: (q: string) => void;
  items: StoredItem[];
  onAdd: (hit: SearchHit) => string | null;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  if (!enabled)
    return (
      <p className="text-[14px] text-ink-2">
        Web search needs a free Tavily key (<code className="font-bold">TAVILY_API_KEY</code> in <code className="font-bold">.env.local</code>). You can still add links by
        hand.
      </p>
    );
  const added = new Set(items.filter((i) => i.status !== "error").map((i) => i.retry?.url ?? i.source?.url));
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(search.query);
        }}
        className="flex gap-2"
      >
        <input
          value={search.query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search query"
          maxLength={300}
          className="min-w-0 flex-1 rounded-md border border-rule bg-white px-3 py-2 text-[15px] focus:border-ink focus:outline-none"
        />
        <button type="submit" className={btn.primary} disabled={search.loading || !search.query.trim()}>
          {search.loading ? <Loader2 size={15} aria-hidden className="animate-spin" /> : <Search size={15} aria-hidden />} Search
        </button>
      </form>
      {search.error && (
        <p role="alert" className="mt-2 text-[13px] text-contested">
          {search.error}
        </p>
      )}
      {msg && (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-contested">
          {msg}
        </p>
      )}
      <ul className="mt-3 max-h-[380px] space-y-2 overflow-y-auto" aria-busy={search.loading}>
        {search.results.map((r) => {
          const isAdded = added.has(r.url);
          const type = classifySource(r.url);
          return (
            <li key={r.url} className="flex items-start gap-2 rounded-md border border-rule bg-white p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug">{r.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                  <TypeTag type={type} />
                  <span className="max-w-[240px] truncate">{r.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                  {r.publishedDate && <span>· {formatDate(r.publishedDate.slice(0, 10))}</span>}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{r.snippet}</p>
              </div>
              <button type="button" onClick={() => setMsg(onAdd(r))} disabled={isAdded} className={`${btn.ghost} shrink-0 border border-rule`}>
                {isAdded ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />} {isAdded ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
      {search.results.length > 0 && <p className="mt-2 text-[12px] text-ink-3">Results from Tavily web search. Pick a mix of source types, starting with official pages.</p>}
    </div>
  );
}

function PasteForm({
  isAi,
  onAdd,
  initialUrl = "",
  initialTitle = "",
}: {
  isAi: boolean;
  onAdd: (b: { title: string; text: string; url?: string; date?: string }) => void;
  initialUrl?: string;
  initialTitle?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [date, setDate] = useState("");
  const [text, setText] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ title: title.trim(), text, url: url.trim() || undefined, date: date || undefined });
        setTitle("");
        setUrl("");
        setDate("");
        setText("");
      }}
      className="space-y-2.5"
    >
      {isAi && (
        <p className="rounded-md bg-[color-mix(in_srgb,var(--ai)_8%,white)] p-2.5 text-[13px] text-ai">
          Paste an answer from ChatGPT, Gemini or another chatbot. GapMap checks each of its claims against your other sources. It is never counted as evidence.
        </p>
      )}
      {!isAi && initialUrl && <p className="text-[13px] text-ink-2">Open the page yourself, copy its text and paste it below. Include the date line if there is one.</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12.5px] font-semibold">
          {isAi ? "Which chatbot? (optional)" : "Title (optional)"}
          <input
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-0.5 block w-full rounded-md border border-rule bg-white px-3 py-2 text-[14px] font-normal focus:border-ink focus:outline-none"
          />
        </label>
        {!isAi && (
          <label className="text-[12.5px] font-semibold">
            Published or updated (optional)
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="mt-0.5 block w-full rounded-md border border-rule bg-white px-3 py-2 text-[14px] font-normal focus:border-ink focus:outline-none"
            />
          </label>
        )}
      </div>
      {!isAi && (
        <label className="block text-[12.5px] font-semibold">
          Where it came from (link, optional)
          <input
            value={url}
            maxLength={2000}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="mt-0.5 block w-full rounded-md border border-rule bg-white px-3 py-2 text-[14px] font-normal focus:border-ink focus:outline-none"
          />
        </label>
      )}
      <label className="block text-[12.5px] font-semibold">
        {isAi ? "The chatbot's answer" : "Text"}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          maxLength={120_000}
          className="mt-0.5 block w-full rounded-md border border-rule bg-white px-3 py-2 text-[14px] font-normal leading-relaxed focus:border-ink focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btn.primary} disabled={text.trim().length < 40}>
          {isAi ? "Add AI answer" : "Add text"}
        </button>
        {text.trim().length > 0 && text.trim().length < 40 && <span className="text-[12.5px] text-ink-3">Paste at least a few sentences.</span>}
      </div>
    </form>
  );
}

function PdfForm({ onAdd }: { onAdd: (f: File) => void }) {
  return (
    <div>
      <label htmlFor="pdf" className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-ink-3 bg-white p-6 text-center hover:border-ink">
        <FileUp size={22} aria-hidden />
        <span className="text-[14px] font-semibold">Choose a PDF (up to 6 MB)</span>
        <span className="text-[12.5px] text-ink-3">Text-based PDFs work best. Scanned images can&rsquo;t be read, so paste their text instead.</span>
      </label>
      <input
        id="pdf"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAdd(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
