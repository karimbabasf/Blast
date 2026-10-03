"use client";

import { Check, Loader2, Mic, MousePointerClick, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { scoreTone } from "../_components/audition-card";
import type { Capability, MarketAgent, Need, Role, Tryout, TryoutStep } from "@/lib/market/types";
import { postJson } from "./db";
import { modelName, money, replyText, ROLE_LABEL, runsIn, summarize } from "./format";
import { useNeed } from "./use-need";

const EXAMPLES: { label: string; text: string; caps: Capability[] }[] = [
  {
    label: "Calendar",
    text: "I need an agent that manages my calendar. It should talk and book meetings for me.",
    caps: ["talk", "act"],
  },
  {
    label: "Email",
    text: "I need an agent that keeps my inbox clean. It should archive newsletters, flag what matters and draft replies for me.",
    caps: ["act"],
  },
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

export function Request({ initialNeed }: { initialNeed: string | null }) {
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

  const running = view.tryouts.some((t) => t.status === "running");
  // Where the request is: reading it, matching agents, running tryouts, ready to pick.
  const phase = !needId ? (busy || questions ? 0 : -1) : !view.tryouts.length ? 1 : running ? 2 : 3;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
      <form onSubmit={submit} className="relative mx-auto w-full max-w-2xl">
        <label htmlFor="need" className="text-2xl font-semibold tracking-tight">
          Describe the Agent You Need
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Every listed agent for the job tries the same task on a private copy of your account. You hire the one that did it best.
        </p>
        <div className="mt-3 rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <textarea
            id="need"
            name="need"
            autoComplete="off"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setQuestions(null);
            }}
            rows={2}
            className="block w-full resize-none rounded-t-xl bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
            <Toggle on={caps.includes("talk")} onClick={() => toggle("talk")} icon={<Mic aria-hidden="true" className="size-3.5" />}>
              Can talk
            </Toggle>
            <Toggle on={caps.includes("act")} onClick={() => toggle("act")} icon={<MousePointerClick aria-hidden="true" className="size-3.5" />}>
              Can act
            </Toggle>
            <span className="ml-2 text-sm text-muted-foreground">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setText(ex.text);
                  setCaps(ex.caps);
                  setQuestions(null);
                }}
                className="h-8 rounded-full border px-3 text-sm transition-colors hover:bg-muted"
              >
                {ex.label}
              </button>
            ))}
            <Button type="submit" disabled={busy || !text.trim()} className="ml-auto h-9 w-28">
              {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {busy && !questions ? "Reading…" : "Find Agents"}
            </Button>
          </div>
        </div>
        {/* Floats over the board, so answering never pushes the page down. */}
        {questions ? (
          <div className="absolute inset-x-0 top-full z-20 mt-2">
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
          </div>
        ) : null}
        <p aria-live="polite" className="absolute top-full left-0 mt-1 max-w-full truncate text-sm text-destructive">
          {error}
        </p>
      </form>

      <Steps phase={phase} />

      <Candidates
        needId={needId}
        need={view.need}
        agents={agents}
        tags={tags.length ? tags : ((view.need as (Need & { answers?: Answer[] }) | null)?.answers ?? [])}
        listed={listed ?? view.agents.length}
        tryouts={view.tryouts}
        steps={view.steps}
      />
      <LogoFactory ids={agents.map((a) => a.id)} />
    </main>
  );
}

const STEPS = ["Read", "Match", "Tryouts", "Pick"];

// Four equal segments, always on screen. Progress only changes their colour.
function Steps({ phase }: { phase: number }) {
  return (
    <div>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === phase ? "step" : undefined} className="flex flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1 rounded-full transition-colors duration-200 ease-out ${
                phase >= index ? "bg-foreground" : "bg-muted"
              } ${index === phase && phase < 3 ? "animate-pulse" : ""}`}
            />
            <span
              className={`text-xs transition-colors duration-200 ease-out ${
                phase >= index ? "font-medium text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {STEPS[phase]}
      </p>
    </div>
  );
}

function Toggle({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-[scale,background-color,color] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] ${
        on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

const SLOTS = 5;

// The board is on screen from the start with five empty slots. Candidates
// fill the slots in place, so nothing on the page moves when they arrive.
function Candidates({
  needId,
  need,
  agents,
  tags,
  listed,
  tryouts,
  steps,
}: {
  needId: string | null;
  need: Need | null;
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
  const empty = Math.max(0, SLOTS - ordered.length);

  async function hire(agentId: string) {
    if (!needId) return;
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

  const task = need ? TASKS[need.role] : undefined;
  const status = !needId
    ? "Idle"
    : !agents.length
      ? "Looking for Agents…"
      : !tryouts.length
        ? "Starting Tryouts…"
        : running
          ? "Tryouts Running…"
          : winnerId
            ? "Tryouts Done"
            : "No Agent Passed";

  return (
    <section aria-label="Tryouts" className="flex flex-col gap-3">
      <div className="flex h-12 items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            {need ? `${ROLE_LABEL[need.role]} Agents` : "Candidates"}
            <span className="font-normal text-muted-foreground tabular-nums">{field.length || ""}</span>
            {tags.map((t) => (
              <span key={t.id} title={t.question} className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {t.answer}
              </span>
            ))}
          </h2>
          <p className="truncate text-sm text-muted-foreground" title={task}>
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : task ? (
              <>
                <span className="text-foreground">The task:</span> {task}
              </>
            ) : (
              "Five agents try the same task on a copy of your account."
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            winnerId ? "border-transparent bg-success/10 text-success" : "text-muted-foreground"
          } ${running ? "animate-pulse" : ""}`}
        >
          {status}
        </span>
      </div>

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        {ordered.map((a, index) => (
          <motion.li
            key={a.id}
            layout="position"
            initial={{ opacity: 0, transform: "scale(0.97)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={{
              layout: { type: "spring", stiffness: 520, damping: 34, mass: 0.45 },
              default: { duration: 0.22, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] },
            }}
          >
            <Candidate
              agent={a}
              tryout={byAgent.get(a.id) ?? null}
              steps={steps.filter((s) => s.tryout_id === byAgent.get(a.id)?.id)}
              winner={a.id === winnerId}
              leading={running && a.id === best?.agent_id}
              hiring={hiring === a.id}
              onHire={() => hire(a.id)}
            />
          </motion.li>
        ))}
        {Array.from({ length: empty }, (_, index) => (
          <li
            key={`slot-${index}`}
            className={`${CARD_HEIGHT} flex items-center justify-center rounded-xl bg-muted/50 text-sm text-muted-foreground/70`}
          >
            Waiting for a candidate
          </li>
        ))}
      </ul>

      <p className="h-5 text-sm text-muted-foreground">
        {need ? (
          <>
            Candidates come from{" "}
            <Link href={`/hub?role=${need.role}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Blast Hub
            </Link>
            : <span className="tabular-nums">{listed}</span> agents for this role.
          </>
        ) : null}
      </p>
    </section>
  );
}

// Every card and every empty slot is this tall, so nothing below ever moves.
const CARD_HEIGHT = "h-[27rem]";

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
  tryout: Tryout | null;
  steps: TryoutStep[];
  winner: boolean;
  leading: boolean;
  hiring: boolean;
  onHire: () => void;
}) {
  const status = tryout?.status;
  const log = useRef<HTMLOListElement>(null);

  // Keep the newest tool call in view while the agent works.
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [steps.length]);

  return (
    <article
      className={`${CARD_HEIGHT} flex flex-col gap-2 overflow-hidden rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-shadow duration-200 ease-out ${
        winner ? "ring-2 ring-success" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <AgentAvatar card={agent} status={status === "running" ? "working" : undefined} verified={winner} />
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold" translate="no">
          {agent.name}
        </h3>
        <Score tryout={tryout} auditionable={agent.auditionable} />
      </div>

      <div className="flex h-5 items-center gap-1.5">
        {winner ? <span className="shrink-0 rounded-full bg-success px-2 py-0.5 text-xs font-medium text-white">Winner</span> : null}
        {leading ? <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Leading</span> : null}
        <p className="truncate text-sm text-muted-foreground" title={`${modelName(agent.model)} by ${agent.builder}`}>
          {modelName(agent.model)} by {agent.builder}
        </p>
      </div>

      <p className="truncate text-xs text-muted-foreground tabular-nums" title={runsIn(agent.runs_in)}>
        <span className="text-foreground">{money(agent.price_month_cents)}</span>/mo ·{" "}
        <span className="text-foreground">{money(agent.price_action_cents)}</span> per action · {runsIn(agent.runs_in)}
      </p>

      <ol ref={log} className="h-[5.25rem] shrink-0 space-y-1 overflow-y-auto overscroll-contain rounded-lg bg-muted/60 p-2.5 font-mono text-xs leading-relaxed">
        {!agent.auditionable ? (
          <li className="font-sans text-muted-foreground">Listed only. Blast cannot test this role yet.</li>
        ) : !steps.length ? (
          <li className="text-muted-foreground">{tryout ? "Waiting for the first step…" : "Queued"}</li>
        ) : (
          steps.map((s) =>
            s.kind === "say" ? (
              <li key={s.id} className="font-sans text-[13px] text-foreground">
                &ldquo;{replyText(s.input, s.output)}&rdquo;
              </li>
            ) : (
              <li key={s.id} className="flex gap-2">
                <span className="w-4 shrink-0 text-right text-muted-foreground tabular-nums">{s.n}</span>
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{s.name}</span>{" "}
                  <span className="text-muted-foreground">{summarize(s.name, s.input)}</span>
                </span>
              </li>
            ),
          )
        )}
        {status === "running" && steps.length ? (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-3 animate-spin" /> working…
          </li>
        ) : null}
      </ol>

      {/* Six rows are reserved, so the checks land without growing the card. */}
      <ul className="flex h-[8.25rem] shrink-0 flex-col text-[13px]">
        {tryout?.checks?.length ? (
          tryout.checks.slice(0, 6).map((c) => (
            <li
              key={c.name}
              title={c.name}
              className={`flex h-[1.375rem] items-center gap-1.5 rounded px-1 ${
                c.passed ? "" : "bg-destructive/10 font-semibold text-destructive"
              }`}
            >
              {c.passed ? (
                <Check className="size-3.5 shrink-0 text-success" aria-label="Passed" />
              ) : (
                <X className="size-3.5 shrink-0" strokeWidth={3} aria-label="Failed" />
              )}
              <span className="truncate">{c.name}</span>
            </li>
          ))
        ) : (
          <li className="px-1 text-muted-foreground/70">
            {agent.auditionable ? "Checks land when the tryout ends." : ""}
          </li>
        )}
      </ul>

      <p className="line-clamp-2 h-8 shrink-0 text-xs text-muted-foreground" title={tryout?.reason ?? undefined}>
        {tryout?.reason}
      </p>

      <Button
        onClick={onHire}
        disabled={hiring || status !== "scored"}
        variant={winner ? "default" : "outline"}
        className={`mt-auto h-9 w-full shrink-0 ${winner ? "bg-success text-white hover:bg-success/90" : ""}`}
      >
        {hiring ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        Hire {agent.name}
      </Button>
    </article>
  );
}

function Score({ tryout, auditionable }: { tryout: Tryout | null; auditionable: boolean }) {
  if (!auditionable) return null;
  if (!tryout || tryout.status === "running") {
    return (
      <p className="flex h-7 w-12 shrink-0 animate-pulse items-center justify-end text-sm text-muted-foreground">
        …<span className="sr-only">Running</span>
      </p>
    );
  }
  if (tryout.status === "failed" || tryout.score == null) {
    return <p className="shrink-0 rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">Failed</p>;
  }
  return (
    <motion.p
      initial={{ opacity: 0, filter: "blur(4px)", transform: "scale(0.96)" }}
      animate={{ opacity: 1, filter: "blur(0px)", transform: "scale(1)" }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-lg leading-none font-semibold tabular-nums ${scoreTone(tryout.score)}`}
    >
      {tryout.score.toFixed(1)}
      <span className="text-xs font-normal opacity-70">/10</span>
    </motion.p>
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
    <div className="rounded-xl border bg-card p-4 shadow-lg animate-in fade-in zoom-in-95 duration-200">
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
                      on ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
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
        <Button type="button" onClick={onDone} disabled={busy} className="h-9 px-4">
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Find Agents
        </Button>
      </div>
    </div>
  );
}
