"use client";

import { Check, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { scoreTone } from "../_components/score-tone";
import type { Capability, MarketAgent, Need, Role, TryoutStep } from "@/lib/market/types";
import { postJson } from "./db";
import { modelName, money, ROLE_LABEL, ROLE_TOOLS, summarize, toolLabel } from "./format";
import { HoldStrip, type LiveNeed, type LiveTryout, ResultCard, RunsOn, SourceBadge } from "./proof";
import { Scorecard } from "./scorecard";
import { useNeed } from "./use-need";
import { useWatch, Waiting } from "./watch";

const DEFAULT_NEED = "Diagnose my 2014 Civic: check engine light, P0301, rough idle";

// What the agent must be able to do, read from the request itself.
function capabilities(text: string): Capability[] {
  return /\b(talk|voice|speak|call|phone)/i.test(text) ? ["talk", "act"] : ["act"];
}

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
  const [text, setText] = useState(DEFAULT_NEED);
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
        capabilities: capabilities(text),
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
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5">
      {watch && !needId ? <Waiting /> : null}
      <form onSubmit={submit} className={watch ? "hidden" : "relative mx-auto w-full max-w-2xl"}>
        <label htmlFor="need" className="text-3xl font-normal tracking-tight">
          Hire the Specialist Your Agent Can&apos;t Be
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Specialists try your real job live. Blast holds the money and pays only when the work proves out.
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
          <div className="flex items-center px-3 pb-3">
            <Button type="submit" disabled={busy || !text.trim()} className="ml-auto h-9 w-36 rounded-full">
              {busy ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {questions ? "Finding…" : "Reading…"}
                </>
              ) : (
                "Find Specialists"
              )}
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
        need={view.need as LiveNeed | null}
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
// Each finished step keeps its own colour, like the stages of an agent timeline.
const STEP_DONE = ["bg-block-blue", "bg-block-mint", "bg-block-peach", "bg-block-gold"];

// Four equal segments, always on screen. Progress only changes their colour.
function Steps({ phase }: { phase: number }) {
  return (
    <div>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === phase ? "step" : undefined} className="flex flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-colors duration-200 ease-out ${
                phase > index || phase === 3 ? STEP_DONE[index] : phase === index ? "bg-primary" : "bg-secondary"
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
  need: LiveNeed | null;
  agents: MarketAgent[];
  tags: Answer[];
  listed: number;
  tryouts: LiveTryout[];
  steps: TryoutStep[];
}) {
  const [hiring, setHiring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const byAgent = new Map(tryouts.map((t) => [t.agent_id, t]));
  const running = tryouts.some((t) => t.status === "running");
  const scored = tryouts.filter((t) => t.status === "scored" && t.score != null);
  const best = scored.reduce<LiveTryout | null>((a, t) => (!a || (t.score ?? 0) > (a.score ?? 0) ? t : a), null);
  const winnerId = best && !running ? best.agent_id : null;

  // Agents posted after the tryouts started were not part of this run.
  const field = tryouts.length ? agents.filter((a) => byAgent.has(a.id)) : agents;
  const ordered = [...field].sort((a, b) => {
    const sa = byAgent.get(a.id)?.score ?? -1;
    const sb = byAgent.get(b.id)?.score ?? -1;
    return running ? 0 : sb - sa;
  });
  // Empty slots hold the space until the candidates are known.
  const empty = ordered.length ? 0 : SLOTS;

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

  const task = need ? (TASKS[need.role] ?? need.text) : undefined;
  const status = !needId
    ? "Idle"
    : !agents.length
      ? "Looking for Specialists…"
      : need?.status === "checkout"
        ? "Winner Doing the Job…"
        : need?.status === "hired"
          ? "Done"
          : !tryouts.length
            ? "Starting Tryouts…"
            : running
              ? "Tryouts Running…"
              : winnerId
                ? "Tryouts Done"
                : "No Specialist Passed";
  const working = running || need?.status === "checkout";

  return (
    <>
    <section aria-label="Tryouts" className="flex flex-col gap-3 rounded-3xl bg-block-peach p-5">
      <div className="flex h-12 items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            {need ? `${ROLE_LABEL[need.role] ?? need.role} Specialists` : "Candidates"}
            <span className="font-normal text-muted-foreground tabular-nums">{field.length || ""}</span>
            {tags.map((t) => (
              <span key={t.id} title={t.question} className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-normal text-foreground/70">
                {t.answer}
              </span>
            ))}
          </h2>
          <p className="truncate text-sm text-foreground/70" title={task}>
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : task ? (
              <>
                <span className="text-foreground">The job:</span> {task}
              </>
            ) : (
              "Specialists try the same job on a private test copy."
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SourceBadge need={need} />
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              winnerId && !working ? "bg-success text-white" : "bg-background/70 text-foreground/70"
            } ${working ? "animate-pulse" : ""}`}
          >
            {status}
          </span>
        </div>
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
              rank={running || !byAgent.get(a.id)?.score ? null : index + 1}
              tryout={byAgent.get(a.id) ?? null}
              steps={steps.filter((s) => s.tryout_id === byAgent.get(a.id)?.id)}
              winner={a.id === winnerId}
              leading={running && a.id === best?.agent_id}
              hiring={hiring === a.id}
              closed={need?.status === "checkout" || need?.status === "hired"}
              onHire={() => hire(a.id)}
            />
          </motion.li>
        ))}
        {Array.from({ length: empty }, (_, index) => (
          <li
            key={`slot-${index}`}
            className={`${CARD_HEIGHT} flex items-center justify-center rounded-2xl bg-background/50 text-sm text-foreground/50`}
          >
            Waiting for a candidate
          </li>
        ))}
      </ul>

      <p className="h-5 text-sm text-foreground/70">
        {need ? (
          <>
            Candidates come from{" "}
            <Link href={`/hub?role=${need.role}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              Blast Hub
            </Link>
            : <span className="tabular-nums">{listed}</span> specialists for this role.
          </>
        ) : null}
      </p>
    </section>
    <Scorecard agents={ordered} byAgent={byAgent} winnerId={winnerId} tools={need ? (ROLE_TOOLS[need.role] ?? []) : []} />
    <HoldStrip hold={need?.hold} />
    <ResultCard result={need?.result} />
    <RunsOn need={need} models={[...new Set(field.map((a) => a.model))]} />
    </>
  );
}

// Every card and every empty slot is this tall, so nothing below ever moves.
const CARD_HEIGHT = "h-[19rem]";

const SHORT_MODEL = /^(Claude|Gemini) /;

function Candidate({
  agent,
  rank,
  tryout,
  steps,
  winner,
  leading,
  hiring,
  closed,
  onHire,
}: {
  agent: MarketAgent;
  rank: number | null;
  tryout: LiveTryout | null;
  steps: TryoutStep[];
  winner: boolean;
  leading: boolean;
  hiring: boolean;
  closed: boolean;
  onHire: () => void;
}) {
  const status = tryout?.status;
  const checks = tryout?.checks ?? [];
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.find((c) => !c.passed);
  const lastStep = steps.filter((s) => s.kind === "tool").at(-1);
  const scored = status === "scored" && tryout?.score != null;

  return (
    <article
      title={tryout?.reason ?? undefined}
      className={`${CARD_HEIGHT} relative flex flex-col gap-3 overflow-hidden rounded-2xl p-3.5 ring-1 transition-[box-shadow,background-color] duration-200 ease-out ${
        winner ? "bg-card ring-3 ring-success" : "bg-card ring-foreground/5"
      }`}
    >
      {rank ? (
        <span
          className={`absolute top-3 right-3 flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
            rank === 1 ? "bg-success text-white" : "bg-muted text-muted-foreground"
          }`}
          aria-label={`Rank ${rank}`}
        >
          {rank}
        </span>
      ) : null}

      <div className="flex items-center gap-3">
        <CheckRing checks={checks} running={status === "running"}>
          <AgentAvatar card={agent} size="lg" />
        </CheckRing>
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate text-base leading-5 font-semibold" translate="no">
            {agent.name}
          </h3>
          <p className="truncate text-xs text-muted-foreground" title={`${modelName(agent.model)} by ${agent.builder}`}>
            {modelName(agent.model).replace(SHORT_MODEL, "")} · {agent.builder}
          </p>
          <p className="mt-0.5 h-4 text-xs font-medium">
            {winner ? (
              <span className="text-success">Winner</span>
            ) : leading ? (
              <span className="text-success">Leading</span>
            ) : status === "running" ? (
              <span className="animate-pulse text-muted-foreground">Trying out…</span>
            ) : !agent.auditionable ? (
              <span className="text-muted-foreground">Listed only</span>
            ) : null}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-1.5">
        <Stat
          label="Score"
          tone={scored ? scoreTone(tryout.score ?? 0) : status === "failed" ? "bg-destructive/10 text-destructive" : ""}
          value={scored ? (tryout.score ?? 0).toFixed(1) : status === "failed" ? "Fail" : null}
        />
        <Stat
          label="Checks"
          tone={checks.length ? (failed ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success") : ""}
          value={checks.length ? `${passed}/${checks.length}` : null}
        />
        <Stat label="Per mo" tone="" value={money(agent.price_month_cents)} />
      </dl>

      {/* What it brings to the job: the role's tools, the ones it lacks struck out. */}
      <ul aria-label="Tools" className="flex h-11 flex-wrap content-start gap-x-0.5 gap-y-1 overflow-hidden">
        {(ROLE_TOOLS[agent.role] ?? agent.tools).map((t) => {
          const has = agent.tools.includes(t);
          return (
            <li
              key={t}
              title={has ? t : `${t}: not available to this agent`}
              className={`h-5 rounded-full px-1.5 text-[11px] leading-5 ${
                has ? "bg-foreground/8 text-foreground" : "text-muted-foreground/60 line-through"
              }`}
            >
              {toolLabel(t)}
            </li>
          );
        })}
      </ul>

      {/* One line, always present: what the agent is doing, or how it ended. */}
      <p className="flex h-5 items-center gap-1.5 text-[13px]">
        {failed ? (
          <>
            <X aria-hidden="true" className="size-3.5 shrink-0 text-destructive" strokeWidth={3} />
            <span className="truncate font-medium text-destructive" title={failed.name}>
              {failed.name}
            </span>
          </>
        ) : checks.length ? (
          <>
            <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" strokeWidth={3} />
            <span className="truncate font-medium text-success">All checks passed</span>
          </>
        ) : lastStep ? (
          <>
            <span aria-hidden="true" className="size-1.5 shrink-0 animate-pulse rounded-full bg-foreground" />
            <span className="truncate font-mono text-xs text-muted-foreground">
              <span className="text-foreground">{lastStep.name}</span> {summarize(lastStep.name, lastStep.input)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/70">{tryout ? "Starting…" : agent.auditionable ? "Queued" : ""}</span>
        )}
      </p>

      <Button
        onClick={onHire}
        disabled={hiring || closed || status !== "scored"}
        variant={winner ? "default" : "outline"}
        className={`mt-auto h-9 w-full shrink-0 rounded-full ${winner ? "bg-success text-white hover:bg-success/90" : "bg-background"}`}
      >
        {hiring ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
        {closed && winner ? "Hired" : `Hire ${agent.name}`}
      </Button>
    </article>
  );
}

// A number first, its label under it. A missing value keeps the tile's size.
function Stat({ label, value, tone }: { label: string; value: string | null; tone: string }) {
  return (
    <div className={`flex h-13 flex-col justify-center rounded-lg px-2 transition-colors duration-200 ease-out ${tone || "bg-muted/60"}`}>
      <dd className="h-6 text-lg leading-6 font-semibold tabular-nums">
        {value ? (
          <motion.span
            key={value}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="block"
          >
            {value}
          </motion.span>
        ) : (
          <span className="animate-pulse text-muted-foreground/50">…</span>
        )}
      </dd>
      <dt className="truncate text-[11px] leading-4 opacity-70">{label}</dt>
    </div>
  );
}

const RING = 64;
const RADIUS = 29;
const CIRCLE = 2 * Math.PI * RADIUS;

// The checks as a ring around the logo: one arc per check, green or red.
function CheckRing({
  checks,
  running,
  children,
}: {
  checks: { name: string; passed: boolean }[];
  running: boolean;
  children: React.ReactNode;
}) {
  const count = checks.length || 6;
  const gap = 5;
  const arc = CIRCLE / count - gap;

  return (
    <div className="relative flex size-16 shrink-0 items-center justify-center">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${RING} ${RING}`}
        className={`absolute inset-0 -rotate-90 ${running ? "animate-pulse" : ""}`}
      >
        {Array.from({ length: count }, (_, index) => {
          const check = checks[index];
          return (
            <circle
              key={index}
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray={`${arc} ${CIRCLE - arc}`}
              strokeDashoffset={-(index * (arc + gap))}
              className={`transition-[stroke] duration-300 ease-out ${
                !check ? "stroke-muted" : check.passed ? "stroke-success" : "stroke-destructive"
              }`}
            />
          );
        })}
      </svg>
      {children}
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
        <Button type="button" onClick={onDone} disabled={busy} className="h-9 w-32 rounded-full">
          {busy ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              Finding…
            </>
          ) : (
            "Find Agents"
          )}
        </Button>
      </div>
    </div>
  );
}
