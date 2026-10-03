"use client";

import { Check, Loader2, Mic, MousePointerClick, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Capability, MarketAgent, Need, Role, Tryout, TryoutStep } from "@/lib/market/types";
import { postJson } from "./db";
import { modelName, money, outcome, tokenCost, replyText, ROLE_LABEL, runsIn, summarize } from "./format";
import { HoldStrip, type LiveNeed, type LiveTryout, ResultCard, RunsOn, SourceBadge } from "./proof";
import { useNeed } from "./use-need";
import { useWatch, Waiting } from "./watch";

const EXAMPLES: { label: string; text: string; caps: Capability[] }[] = [
  { label: "Mechanic", text: "Diagnose my 2014 Civic: check engine light, P0301, rough idle", caps: ["act"] },
  { label: "Medical billing", text: "Code this clinic visit for billing", caps: ["act"] },
  { label: "Calendar", text: "Manage my calendar", caps: ["talk", "act"] },
];

type Question = { id: string; question: string; options: string[] };
type Answer = { id: string; question: string; answer: string };

// Clarifying questions are optional: any failure or an answer slower than 8 s skips them.
async function clarify(text: string): Promise<Question[] | null> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch("/api/needs/clarify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { questions?: Question[] };
    return (data.questions ?? []).filter((q) => q.id && q.question && q.options?.length);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

const TASKS: Partial<Record<Role, string>> = {
  calendar: "Book a 30 minute call titled 'Rakha sync' with rakha@xochitl.coffee next Tuesday afternoon. Do not double book.",
  email: "Clean up the inbox: archive the newsletters, label the investor email 'Important', and draft a reply to Grace confirming Thursday at 3pm.",
};

export function Request({ initialNeed, watch = false }: { initialNeed: string | null; watch?: boolean }) {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [caps, setCaps] = useState<Capability[]>(EXAMPLES[0].caps);
  const [needId, setNeedId] = useState<string | null>(initialNeed);
  const [posted, setPosted] = useState<MarketAgent[]>([]);
  const [listed, setListed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Answer[]>([]);
  const view = useNeed(needId);
  const follow = useCallback((id: string) => {
    setPosted([]);
    setListed(null);
    setTags([]);
    setNeedId(id);
    window.history.replaceState(null, "", `/?need=${id}&watch=1`);
  }, []);
  useWatch(watch, follow);

  const toggle = (c: Capability) =>
    setCaps((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    if (questions) return findAgents(questions);
    setBusy(true);
    setError(null);
    const asked = await clarify(text);
    if (asked?.length) {
      setAnswers({});
      setQuestions(asked);
      setBusy(false);
      return;
    }
    await findAgents([]);
  }

  async function findAgents(qs: Question[]) {
    const picked: Answer[] = qs
      .filter((q) => answers[q.id])
      .map((q) => ({ id: q.id, question: q.question, answer: answers[q.id] }));
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ need: Need; agents?: MarketAgent[]; listed?: MarketAgent[] }>("/api/needs", {
        text,
        capabilities: caps,
        answers: picked,
      });
      setPosted(res.agents ?? []);
      setListed(res.listed?.length ?? null);
      setTags(picked);
      setQuestions(null);
      setNeedId(res.need.id);
      window.history.replaceState(null, "", `/?need=${res.need.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the request");
    } finally {
      setBusy(false);
    }
  }

  // The need's candidates: what POST /api/needs picked, else (after a reload) whoever has a tryout in it.
  const picked = new Set(posted.map((a) => a.id));
  const agents = posted.length ? (view.agents.length ? view.agents.filter((a) => picked.has(a.id)) : posted) : view.agents;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
      {watch && !needId ? <Waiting /> : null}
      <form onSubmit={submit} className={watch ? "hidden" : "mx-auto max-w-2xl"}>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Blast</h1>
        <label htmlFor="need" className="mt-3 block text-xl font-medium tracking-tight sm:text-2xl">
          Hire the specialist your agent can&apos;t be.
        </label>
        <p className="mt-2 text-base text-muted-foreground">
          Specialists are built by other people, with their own tools and data. Blast tries them out live on your real job, holds
          the money, and pays only when the work proves out.
        </p>
        <div className="mt-5 rounded-xl border bg-card shadow-xs focus-within:border-(--hire) focus-within:ring-3 focus-within:ring-(--hire)/15">
          <textarea
            id="need"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setQuestions(null);
            }}
            rows={3}
            className="block w-full resize-none rounded-t-xl bg-transparent px-4 pt-4 pb-2 text-base outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
            <Toggle on={caps.includes("talk")} onClick={() => toggle("talk")} icon={<Mic className="size-3.5" />}>
              Can talk
            </Toggle>
            <Toggle on={caps.includes("act")} onClick={() => toggle("act")} icon={<MousePointerClick className="size-3.5" />}>
              Can act
            </Toggle>
            <Button type="submit" disabled={busy || !text.trim()} className="ml-auto h-9 bg-(--hire) px-4 hover:bg-(--hire)/90">
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy && !questions ? "Reading" : "Find specialists"}
            </Button>
          </div>
        </div>
        {questions ? (
          <Questions
            questions={questions}
            answers={answers}
            busy={busy}
            onPick={(id, a) => setAnswers((cur) => ({ ...cur, [id]: cur[id] === a ? "" : a }))}
            onSkip={() => {
              setAnswers({});
              void findAgents([]);
            }}
            onDone={() => void findAgents(questions)}
          />
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                setText(ex.text);
                setCaps(ex.caps);
                setQuestions(null);
              }}
              className="rounded-full border px-3 py-1 text-foreground transition-colors hover:bg-muted"
            >
              {ex.label}
            </button>
          ))}
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </form>

      {needId ? <Candidates needId={needId} need={view.need} agents={agents} tags={tags.length ? tags : ((view.need as (Need & { answers?: Answer[] }) | null)?.answers ?? [])} listed={listed ?? view.agents.length} tryouts={view.tryouts} steps={view.steps} /> : null}
    </main>
  );
}

function Toggle({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
        on ? "border-(--hire)/40 bg-(--hire-soft) text-(--hire)" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Candidates({
  needId,
  need,
  agents,
  tags,
  listed,
  tryouts,
  steps,
}: {
  needId: string;
  need: LiveNeed | null;
  agents: MarketAgent[];
  tags: Answer[];
  listed: number;
  tryouts: Tryout[];
  steps: TryoutStep[];
}) {
  const [hiring, setHiring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byAgent = new Map(tryouts.map((t) => [t.agent_id, t]));
  const running = tryouts.some((t) => t.status === "running");
  const scored = tryouts.filter((t) => t.status === "scored" && t.score != null);
  const best = scored.reduce<Tryout | null>((a, t) => (!a || (t.score ?? 0) > (a.score ?? 0) ? t : a), null);
  const winnerId = best && !running ? best.agent_id : null;

  // Agents posted after the tryouts started were not part of this run.
  const field = tryouts.length ? agents.filter((a) => byAgent.has(a.id)) : agents;
  const ordered = [...field].sort((a, b) => {
    const sa = byAgent.get(a.id)?.score ?? -1;
    const sb = byAgent.get(b.id)?.score ?? -1;
    return running ? 0 : sb - sa;
  });

  async function hire(agentId: string) {
    setHiring(agentId);
    setError(null);
    try {
      const { url } = await postJson<{ url: string }>(`/api/needs/${needId}/checkout`, { agent_id: agentId });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setHiring(null);
    }
  }

  const task = need ? (TASKS[need.role] ?? need.text) : undefined;

  return (
    <section className="mt-12">
      <SourceBadge need={need} />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {need ? `${ROLE_LABEL[need.role] ?? need.role} specialists` : "Finding specialists"}
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{field.length || ""}</span>
        </h2>
        <p className="text-base text-muted-foreground">
          {need?.status === "checkout"
            ? "Winner doing the real job"
            : need?.status === "hired"
              ? "Done"
              : need?.status === "waiting"
                ? "Nobody passed, hold released"
                : !tryouts.length
                  ? "Starting tryouts"
                  : running
                    ? "Tryouts running"
                    : winnerId
                      ? "Tryouts done"
                      : "No specialist passed"}
        </p>
      </div>
      {task ? (
        <p className="mt-2 max-w-3xl text-lg text-muted-foreground">
          <span className="text-foreground">The job:</span> {task}
        </p>
      ) : null}
      <HoldStrip hold={need?.hold} />
      <ResultCard result={need?.result} />
      {tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t.id} title={t.question} className="rounded-full bg-(--hire-soft) px-2.5 py-0.5 text-xs text-(--hire)">
              {t.answer}
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {!agents.length ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Looking for listed agents
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {ordered.map((a) => (
            <Candidate
              key={a.id}
              agent={a}
              tryout={byAgent.get(a.id) ?? null}
              steps={steps.filter((s) => s.tryout_id === byAgent.get(a.id)?.id)}
              winner={a.id === winnerId}
              leading={running && a.id === best?.agent_id}
              hiring={hiring === a.id}
              onHire={() => hire(a.id)}
            />
          ))}
        </div>
      )}
      <RunsOn need={need} models={[...new Set(field.map((a) => a.model))]} />
      {need ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Candidates come from{" "}
          <Link href={`/hub?role=${need.role}`} className="font-medium text-(--hire) hover:underline">
            Blast Hub
          </Link>
          : <span className="tabular-nums">{listed}</span> specialists for this role.
        </p>
      ) : null}
    </section>
  );
}

function Candidate({
  agent,
  tryout,
  steps,
  winner,
  leading,
  hiring,
  onHire,
}: {
  agent: MarketAgent;
  tryout: LiveTryout | null;
  steps: TryoutStep[];
  winner: boolean;
  leading: boolean;
  hiring: boolean;
  onHire: () => void;
}) {
  const status = tryout?.status;
  return (
    <article
      className={`flex flex-col rounded-xl border bg-card p-4 transition-shadow ${
        winner ? "border-(--hire) shadow-[0_0_0_1px_var(--hire),0_8px_24px_-12px_var(--hire)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold">{agent.name}</h3>
            {winner ? <span className="rounded-full bg-(--hire) px-2 py-0.5 text-xs font-medium text-white">Winner</span> : null}
            {leading ? <span className="rounded-full bg-(--hire-soft) px-2 py-0.5 text-xs font-medium text-(--hire)">Leading</span> : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {modelName(agent.model)} by {agent.builder}
          </p>
        </div>
        <Score tryout={tryout} auditionable={agent.auditionable} />
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>{runsIn(agent.runs_in)}</div>
        <div className="tabular-nums">
          <span className="text-foreground">{money(agent.price_month_cents)}</span>/mo
        </div>
        <div className="tabular-nums">
          <span className="text-foreground">{money(agent.price_action_cents)}</span> per action
        </div>
        {tryout?.usage?.cost_usd != null ? (
          <div className="tabular-nums" title={`${tryout.usage.input_tokens ?? 0} in, ${tryout.usage.output_tokens ?? 0} out`}>
            <span className="text-foreground">{tokenCost(tryout.usage.cost_usd)}</span> in tokens
          </div>
        ) : null}
      </dl>

      {!agent.auditionable ? (
        <p className="mt-4 text-sm text-muted-foreground">Listed only. Blast cannot test this role yet.</p>
      ) : (
        <>
          <ol className="mt-4 max-h-80 space-y-1.5 overflow-y-auto rounded-lg bg-muted/60 p-3 font-mono text-sm leading-relaxed">
            {!steps.length ? (
              <li className="text-muted-foreground">{tryout ? "Waiting for the first step" : "Queued"}</li>
            ) : (
              steps.map((s) =>
                s.kind === "say" ? (
                  <li key={s.id} className="font-sans text-base text-foreground">
                    &ldquo;{replyText(s.input, s.output)}&rdquo;
                  </li>
                ) : (
                  <li key={s.id} className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <span className="w-5 shrink-0 text-right text-muted-foreground tabular-nums">{s.n}</span>
                    <span className="min-w-0 break-words">
                      <span className="text-(--hire)">{s.name}</span> {summarize(s.name, s.input)}
                      {outcome(s.name, s.output) ? (
                        <span className="text-foreground">
                          {" "}
                          <span className="text-muted-foreground">-&gt;</span> {outcome(s.name, s.output)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ),
              )
            )}
            {status === "running" && steps.length ? (
              <li className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> working
              </li>
            ) : null}
          </ol>

          {tryout?.checks?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {tryout.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-2">
                  {c.passed ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="passed" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="failed" />
                  )}
                  <span className={c.passed ? "" : "text-muted-foreground"}>{c.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {tryout?.reason ? <p className="mt-3 line-clamp-3 text-sm text-muted-foreground" title={tryout.reason}>{tryout.reason}</p> : null}
        </>
      )}

      {status === "scored" ? <div className="min-h-4 flex-1" /> : null}
      {status === "scored" ? (
        <Button
          onClick={onHire}
          disabled={hiring}
          variant={winner ? "default" : "outline"}
          className={`mt-auto h-9 w-full ${winner ? "bg-(--hire) hover:bg-(--hire)/90" : ""}`}
        >
          {hiring ? <Loader2 className="animate-spin" /> : null}
          Hire {agent.name}
        </Button>
      ) : null}
    </article>
  );
}

function Score({ tryout, auditionable }: { tryout: Tryout | null; auditionable: boolean }) {
  if (!auditionable) return null;
  if (!tryout || tryout.status === "running")
    return <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-muted-foreground" aria-label="running" />;
  if (tryout.status === "failed" || tryout.score == null)
    return <span className="text-sm text-destructive">Failed</span>;
  return (
    <div className="shrink-0 text-right">
      <div className="text-2xl font-semibold tabular-nums leading-none">{tryout.score.toFixed(1)}</div>
      <div className="mt-1 text-xs text-muted-foreground">of 10</div>
    </div>
  );
}

function Questions({
  questions,
  answers,
  busy,
  onPick,
  onSkip,
  onDone,
}: {
  questions: Question[];
  answers: Record<string, string>;
  busy: boolean;
  onPick: (id: string, answer: string) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const current = questions.find((q) => !answers[q.id]) ?? null;

  // Number keys answer the first open question; Enter sends.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (busy || e.metaKey || e.ctrlKey || e.altKey || t?.closest("textarea, input, select")) return;
      if (e.key === "Enter" && !t?.closest("button")) {
        e.preventDefault();
        onDone();
        return;
      }
      const n = Number(e.key);
      if (!current || !Number.isInteger(n) || n < 1 || n > current.options.length) return;
      e.preventDefault();
      onPick(current.id, current.options[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, current, onDone, onPick]);

  return (
    <div className="mt-3 rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">A few quick questions</h2>
        <button type="button" onClick={onSkip} disabled={busy} className="text-sm text-muted-foreground hover:text-foreground">
          Skip
        </button>
      </div>
      <ol className="mt-3 space-y-4">
        {questions.map((q) => (
          <li key={q.id}>
            <p className="text-sm">{q.question}</p>
            <div role="radiogroup" aria-label={q.question} className="mt-2 flex flex-wrap gap-1.5">
              {q.options.map((o, i) => {
                const on = answers[q.id] === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onPick(q.id, o)}
                    className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors ${
                      on ? "border-(--hire) bg-(--hire) text-white" : "hover:bg-muted"
                    }`}
                  >
                    {q === current ? (
                      <kbd className="font-mono text-[11px] text-muted-foreground">{i + 1}</kbd>
                    ) : null}
                    {o}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="hidden text-xs text-muted-foreground sm:inline">Number keys pick, Enter sends</span>
        <Button type="button" onClick={onDone} disabled={busy} className="h-9 bg-(--hire) px-4 hover:bg-(--hire)/90">
          {busy ? <Loader2 className="animate-spin" /> : null}
          Find agents
        </Button>
      </div>
    </div>
  );
}
