"use client";

import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { MarketAgent, TryoutStep } from "@/lib/market/types";
import { db } from "./db";
import { clock, money, ROLE_LABEL } from "./format";
import { type Brand, labOf, Logo } from "./logos";
import { capturedCents, type LiveNeed, type LiveTryout, stripeLinks, workLine } from "./proof";
import { bestTryout, DeliveredStage, isDelivery, isSite, LiveStage, phaseOf, type Phase, StageFrame, useCountUp, useHubAgents, useNow } from "./stage";
import { useNeed } from "./use-need";

const MCP = "claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp";

const CARD = "rounded-xl border bg-card";
const OUT = [0.23, 1, 0.32, 1] as const;

// What each role hires and hands back, in plain words.
const NOUN: Record<string, [string, string, string]> = {
  web_design: ["web designer", "web designers", "site"],
  auto_repair: ["mechanic", "mechanics", "repair quote"],
  medical_billing: ["medical biller", "medical billers", "billing claim"],
};

const at = (iso: string) => new Date(iso).getTime();

// Claude Code's hires, newest first. Realtime on needs; a 2 s poll covers a dropped socket.
function useHires() {
  const [needs, setNeeds] = useState<LiveNeed[] | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      db()
        .from("needs")
        .select("*")
        .eq("source", "claude-code")
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => {
          if (active && data) setNeeds(data as LiveNeed[]);
        });
    const channel = db()
      .channel("dashboard-needs")
      .on("postgres_changes", { event: "*", schema: "public", table: "needs" }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 2000);
    refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
      db().removeChannel(channel);
    };
  }, []);
  return needs;
}

export function Dashboard({ initialNeed }: { initialNeed: string | null }) {
  const needs = useHires();
  const hub = useHubAgents();
  const [picked, setPicked] = useState<string | null>(initialNeed);
  const newest = needs?.[0]?.id ?? null;
  const [seen, setSeen] = useState<string | null>(null);

  // A new hire always takes focus, even after a click on an older one.
  if (newest && newest !== seen) {
    setSeen(newest);
    if (seen) setPicked(null);
  }
  const focus = picked ?? newest;

  return (
    <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-5 pb-14 sm:px-6 sm:pt-7">
      {!needs ? null : !focus ? (
        <Empty />
      ) : (
        <>
          <Focus key={focus} id={focus} fallback={needs.find((n) => n.id === focus) ?? null} hub={hub} />
          {needs.length > 1 ? <History needs={needs} focus={focus} onPick={setPicked} /> : null}
        </>
      )}
    </main>
  );
}

function Empty() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className={`${CARD} px-6 py-7`}>
        <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em] text-balance text-foreground">Waiting for an agent to hire</h1>
        <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
          When Claude Code hits work it cannot do well alone, it hires a specialist here. Specialists try out live on the real job, and Blast pays only the one that passes every check.
        </p>
        <p className="mt-6 text-sm font-medium text-muted-foreground">Connect Claude Code to Blast</p>
        <code className="mt-2 block overflow-x-auto rounded-xl bg-muted px-4 py-3 font-mono text-xs text-foreground select-all">{MCP}</code>
      </div>
      <StageFrame>
        <div className="flex min-h-[360px] items-center justify-center p-6 text-sm text-(--st-2)">
          <Loader2 className="mr-2 size-4 animate-spin" /> Listening for the next hire
        </div>
      </StageFrame>
    </div>
  );
}

type View = { need: LiveNeed; tryouts: LiveTryout[]; steps: TryoutStep[] };

// A finished hire played back on its own recorded clock: steps land when they landed, scores when they were scored.
function rewind(v: View, ms: number): View & { over: boolean; clock: number } {
  const t0 = at(v.need.created_at);
  const rel = (iso: string) => at(iso) - t0;
  const firstTry = v.tryouts.length ? Math.min(...v.tryouts.map((t) => rel(t.created_at))) : 0;
  const lastStep = v.steps.length ? Math.max(...v.steps.map((s) => rel(s.created_at))) : firstTry;
  const searchAt = Math.max(0, firstTry - 1500);
  const doneAt = lastStep + 1500;
  const speed = Math.max(1, (doneAt - searchAt) / 18000);
  const t = searchAt + (ms - 1300) * speed;
  const over = t >= doneAt;
  const steps = v.steps.filter((s) => rel(s.created_at) <= t);
  const tryouts = v.tryouts
    .filter((tr) => rel(tr.created_at) <= t)
    .map((tr) => {
      const own = v.steps.filter((s) => s.tryout_id === tr.id && !isDelivery(s));
      const end = (own.length ? Math.max(...own.map((s) => rel(s.created_at))) : rel(tr.created_at)) + 600;
      return t >= end ? tr : { ...tr, status: "running" as const, score: null, checks: [] };
    });
  const scored = tryouts.length === v.tryouts.length && tryouts.every((tr) => tr.status !== "running");
  const h = v.need.hold;
  const need: LiveNeed = {
    ...v.need,
    search: t >= searchAt ? v.need.search : null,
    status: over ? v.need.status : scored && tryouts.length ? "checkout" : "auditioning",
    result: over ? v.need.result : null,
    hold: over || !h ? h : { ...h, status: "held", captured_cents: undefined, transfer: undefined, builder_cents: undefined, blast_cents: undefined, agent_id: undefined },
  };
  return { need, tryouts, steps, over, clock: t0 + t };
}

function Focus({ id, fallback, hub }: { id: string; fallback: LiveNeed | null; hub: ReturnType<typeof useHubAgents> }) {
  const view = useNeed(id);
  const base = (view.need as LiveNeed | null) ?? fallback;
  const [replayFrom, setReplayFrom] = useState<number | null>(null);
  const liveNow = base ? phaseOf(base, view.tryouts as LiveTryout[]) : "done";
  const ticking = replayFrom != null || liveNow === "search" || liveNow === "tryout" || liveNow === "build";
  const wall = useNow(ticking, 100);
  if (!base) return null;

  const real: View = { need: base, tryouts: view.tryouts as LiveTryout[], steps: view.steps };
  const replay = replayFrom != null ? rewind(real, wall - replayFrom) : null;
  const shown = replay && !replay.over ? replay : real;
  const { need, tryouts, steps } = shown;
  const agents = new Map(view.agents.map((a) => [a.id, a]));
  const phase = phaseOf(need, tryouts);
  const best = phase === "build" || phase === "done" ? bestTryout(tryouts) : null;
  const winnerId = need.result?.agent_id ?? need.hold?.agent_id ?? best?.agent_id ?? null;
  const winner = winnerId ? agents.get(winnerId) : undefined;

  return (
    <article className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Story need={need} tryouts={tryouts} steps={steps} agents={agents} phase={phase} winner={winner} winnerId={winnerId} />
      <StageFrame>
        <AnimatePresence mode="wait" initial={false}>
          {phase === "done" && need.result ? (
            <motion.div key="done" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DeliveredStage result={need.result} onReplay={() => setReplayFrom(Date.now())} />
            </motion.div>
          ) : (
            <motion.div key={`live-${replayFrom ?? "now"}`} exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 0.3, ease: OUT }}>
              <LiveStage
                need={need}
                tryouts={tryouts}
                steps={steps}
                agents={agents}
                hub={hub}
                now={replay && !replay.over ? replay.clock : wall}
                winnerId={phase === "tryout" ? null : winnerId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </StageFrame>
    </article>
  );
}

function headline(phase: Phase, need: LiveNeed, tryouts: LiveTryout[], winner?: string) {
  const [one, many, thing] = NOUN[need.role] ?? ["specialist", "specialists", "work"];
  if (phase === "search") return `Finding a ${one} for this job`;
  if (phase === "tryout") return tryouts.length === 1 ? `1 ${one} is trying out on the job` : `${tryouts.length} ${many} are trying out on the job`;
  if (phase === "build") return winner ? `Hired ${winner}. Now building your ${thing}.` : "Scoring the tryouts";
  if (phase === "done") return `${winner ?? "The winner"} delivered your ${thing}`;
  return "Nobody passed, so nobody got paid";
}

type StepState = "done" | "now" | "todo" | "off";

function Story({
  need,
  tryouts,
  steps,
  agents,
  phase,
  winner,
  winnerId,
}: {
  need: LiveNeed;
  tryouts: LiveTryout[];
  steps: TryoutStep[];
  agents: Map<string, MarketAgent>;
  phase: Phase;
  winner?: MarketAgent;
  winnerId: string | null;
}) {
  const [jobOpen, setJobOpen] = useState(false);
  const h = need.hold;
  const released = phase === "released";
  const running = tryouts.filter((t) => t.status === "running").length;
  const calls = steps.filter((s) => s.kind === "tool" && !isDelivery(s)).length;
  const out = need.result?.output;
  const site = isSite(out) ? out : null;
  const title = headline(phase, need, tryouts, winner?.name ?? need.result?.agent_name);

  const search: StepState = need.search || tryouts.length ? "done" : "now";
  const tryout: StepState = !tryouts.length ? "todo" : running ? "now" : "done";
  const pay: StepState = released ? "off" : h?.status === "captured" ? "done" : phase === "build" ? "now" : "todo";
  const deliver: StepState = released ? "off" : need.result ? "done" : phase === "build" ? "now" : "todo";

  return (
    <div className={`${CARD} min-w-0 px-5 pt-6 pb-5 sm:px-7`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.h1
          key={title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: OUT }}
          className="text-2xl leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-foreground sm:text-3xl"
        >
          {title}
        </motion.h1>
      </AnimatePresence>
      <p className="mt-2 text-sm text-muted-foreground">
        {need.source === "claude-code" ? "Claude Code asked over MCP" : "Asked on the web"} at <span className="tabular-nums">{clock(need.created_at)}</span>
        <span className="mx-1.5 text-muted-foreground/70">/</span>
        {ROLE_LABEL[need.role] ?? need.role}
      </p>

      <button
        type="button"
        onClick={() => setJobOpen((o) => !o)}
        aria-expanded={jobOpen}
        className="mt-4 block w-full rounded-2xl bg-muted px-4 py-3 text-left ring-1 ring-border transition-colors hover:bg-muted"
      >
        <span className="block text-xs font-medium text-muted-foreground">The job</span>
        <span className={`mt-1 text-sm leading-relaxed text-pretty text-foreground ${jobOpen ? "block" : "line-clamp-3"}`}>{need.text}</span>
      </button>

      <ol className="mt-6">
        <Step state={search} title="Search the Hub" brand="supabase" by="pgvector">
          {need.search ? (
            <>
              Matched the job against <Num>{need.search.listings}</Num> specialists.{" "}
              {tryouts.length ? (
                <>
                  Picked the closest <Num>{tryouts.length}</Num> for a tryout.
                </>
              ) : (
                <>
                  <Num>{need.search.matches?.length ?? 0}</Num> came close.
                </>
              )}
            </>
          ) : (
            "Matching the job against every specialist on the Hub."
          )}
        </Step>
        <Step state={tryout} title="Try out on the real job" brand="vercel" by="Sandbox">
          {!tryouts.length ? (
            "Each pick does this exact job in its own sandbox, then gets checked and scored."
          ) : (
            <>
              {running ? (
                <span className="tabular-nums">
                  {running} of {tryouts.length} still working, {calls} tool calls so far.
                </span>
              ) : null}
              <Board tryouts={tryouts} agents={agents} winnerId={phase === "tryout" ? null : winnerId} />
            </>
          )}
        </Step>
        <Step state={pay} title="Pay on proof" brand="stripe" by="MPP">
          <Payment hold={h} builder={winner?.builder} released={released} />
        </Step>
        <Step state={deliver} title="Deliver" last>
          {released ? (
            "Nothing to deliver."
          ) : need.result ? (
            site ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-foreground">{site.title}</span>
                {site.live_url ? (
                  <a href={site.live_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-(--hire) hover:underline">
                    Open live site <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </span>
            ) : (
              <span className="font-medium text-foreground">{workLine(need.result.output as Parameters<typeof workLine>[0]) || "Delivered."}</span>
            )
          ) : phase === "build" && winner ? (
            `${winner.name} is doing the real job now.`
          ) : (
            "The winner does the real job and hands it back here."
          )}
        </Step>
      </ol>
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground tabular-nums">{children}</span>;
}

function Step({ state, title, brand, by, last, children }: { state: StepState; title: string; brand?: Brand; by?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3.5">
      <div className="flex flex-col items-center">
        <StepIcon state={state} />
        {!last ? <span className={`my-1.5 w-0.5 flex-1 rounded-full transition-colors duration-500 ${state === "done" ? "bg-muted-foreground" : "bg-secondary"}`} /> : null}
      </div>
      <div className={`min-w-0 ${last ? "" : "pb-5"}`}>
        <div className="flex min-h-7 items-center justify-between gap-3">
          <span className={`text-base font-semibold tracking-[-0.01em] ${state === "todo" ? "text-muted-foreground/70" : "text-foreground"}`}>{title}</span>
          {brand ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground/70">
              <Logo brand={brand} className={`size-3.5 ${brand === "vercel" ? "text-foreground" : ""}`} />
              {by}
            </span>
          ) : null}
        </div>
        <div className={`mt-0.5 text-sm leading-relaxed text-pretty ${state === "todo" ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{children}</div>
      </div>
    </li>
  );
}

function StepIcon({ state }: { state: StepState }) {
  return (
    <span className="relative grid size-7 shrink-0 place-items-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 26 }}
          className={`absolute inset-0 grid place-items-center rounded-full ${
            state === "done" ? "bg-foreground text-white" : state === "now" ? "bg-(--hire-soft) text-(--hire) ring-1 ring-(--hire)/30" : state === "off" ? "bg-secondary text-muted-foreground" : "ring-[1.5px] ring-border ring-inset"
          }`}
        >
          {state === "done" ? <Check className="size-4" strokeWidth={3} /> : state === "now" ? <Loader2 className="size-4 animate-spin" /> : state === "off" ? <X className="size-4" strokeWidth={2.5} /> : null}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Board({ tryouts, agents, winnerId }: { tryouts: LiveTryout[]; agents: Map<string, MarketAgent>; winnerId: string | null }) {
  const rows = [...tryouts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <ul className="mt-2.5 -mx-2">
      {rows.map((t) => (
        <motion.li key={t.id} layout transition={{ type: "spring", stiffness: 380, damping: 32 }}>
          <BoardRow tryout={t} agent={agents.get(t.agent_id)} win={t.agent_id === winnerId} />
        </motion.li>
      ))}
    </ul>
  );
}

function BoardRow({ tryout: t, agent, win }: { tryout: LiveTryout; agent?: MarketAgent; win: boolean }) {
  const [open, setOpen] = useState(false);
  const score = useCountUp(t.status === "scored" ? t.score : null);
  const lab = agent ? labOf(agent.model) : null;
  const checks = t.checks ?? [];
  const passed = checks.filter((c) => c.passed).length;
  return (
    <div className={`rounded-xl transition-colors duration-300 ${win ? "bg-(--hire-soft)" : open ? "bg-muted" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={!checks.length}
        className="grid w-full grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 rounded-xl px-2 py-2 text-left enabled:hover:bg-muted disabled:cursor-default sm:grid-cols-[minmax(0,1fr)_minmax(48px,96px)_4.5rem]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {lab ? <Logo brand={lab} className="size-3.5 shrink-0" /> : null}
          <span className="truncate text-sm font-medium text-foreground">{agent?.name ?? "Specialist"}</span>
          <span className="hidden truncate text-sm text-muted-foreground/70 sm:inline">{agent?.builder}</span>
          {win ? <span className="shrink-0 rounded-md bg-(--hire) px-1.5 py-px text-xs font-semibold text-white">Hired</span> : null}
        </span>
        <span className="hidden h-1.5 overflow-hidden rounded-full bg-secondary sm:block">
          <span
            className={`block h-full rounded-full transition-[width] duration-700 ease-out ${win ? "bg-(--hire)" : passed === checks.length && checks.length ? "bg-foreground" : "bg-muted-foreground/60"}`}
            style={{ width: `${t.status === "scored" ? Math.max(4, score * 10) : 0}%` }}
          />
        </span>
        <span className="flex items-baseline justify-end gap-1.5 tabular-nums">
          {t.status === "running" ? (
            <Loader2 className="size-3.5 animate-spin text-(--hire)" />
          ) : t.status === "scored" ? (
            <>
              <span className="text-base font-semibold text-foreground">{score.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground/70">
                {passed}/{checks.length}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Failed</span>
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && checks.length ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: OUT }}
            className="overflow-hidden"
          >
            <div className="px-2 pt-0.5 pb-3">
              <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {checks.map((c) => (
                  <li key={c.name} className="flex items-start gap-1.5">
                    {c.passed ? <Check className="mt-0.5 size-3.5 shrink-0 text-foreground" strokeWidth={3} /> : <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" strokeWidth={3} />}
                    <span className={c.passed ? "text-foreground" : "text-muted-foreground"}>{c.name}</span>
                  </li>
                ))}
              </ul>
              {t.reason ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.reason}</p> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Payment({ hold: h, builder, released }: { hold: LiveNeed["hold"]; builder?: string; released: boolean }) {
  if (!h) return <>No payment is held for this job.</>;
  if (released || h.status === "released")
    return (
      <>
        The <Num>{money(h.amount_cents)}</Num> hold was released. Nothing was charged.
      </>
    );
  if (h.status !== "captured")
    return (
      <>
        <Num>{money(h.amount_cents)}</Num> held on Stripe{h.via === "mpp" ? ", paid by Claude Code over MPP" : ""}. Captured only if the winner passes every check.
      </>
    );
  return (
    <>
      <Cents value={capturedCents(h)} /> paid from the <Num>{money(h.amount_cents)}</Num> hold.{" "}
      {h.builder_cents != null ? (
        <>
          {builder ?? "The builder"} got <Cents value={h.builder_cents} />
          {h.blast_cents != null ? (
            <>
              , Blast kept <Num>{money(h.blast_cents)}</Num>
            </>
          ) : null}
          .
        </>
      ) : null}
      <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={stripeLinks.payment(h.payment_intent)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-(--hire) hover:underline">
          Stripe payment <ExternalLink className="size-3" />
        </a>
        {h.transfer ? (
          <a href={stripeLinks.transfer(h.transfer)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-(--hire) hover:underline">
            Connect payout <ExternalLink className="size-3" />
          </a>
        ) : null}
      </span>
    </>
  );
}

function Cents({ value }: { value: number }) {
  const v = useCountUp(value);
  return <span className="font-semibold text-foreground tabular-nums">{money(Math.round(v))}</span>;
}

function History({ needs, focus, onPick }: { needs: LiveNeed[]; focus: string; onPick: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? needs : needs.slice(0, 6);
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-foreground">Earlier hires</h2>
        <span className="text-sm text-muted-foreground/70 tabular-nums">{needs.length}</span>
      </div>
      <ul className={`${CARD} mt-3 divide-y divide-border overflow-hidden`}>
        {shown.map((n) => {
          const released = n.status === "waiting" || n.hold?.status === "released";
          const busy = n.status === "auditioning" || n.status === "checkout";
          const result = released
            ? "Nobody passed"
            : busy
              ? "In progress"
              : [n.result?.agent_name, n.hold?.status === "captured" ? money(capturedCents(n.hold)) : null].filter(Boolean).join(", ") || "Done";
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(n.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                aria-current={n.id === focus}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-muted sm:grid-cols-[3.25rem_8.5rem_minmax(0,1fr)_auto] sm:px-5 ${
                  n.id === focus ? "bg-(--hire-soft)/70" : ""
                }`}
              >
                <span className="order-2 text-xs text-muted-foreground/70 tabular-nums sm:order-none sm:text-sm">{clock(n.created_at)}</span>
                <span className="order-3 hidden truncate text-sm text-muted-foreground sm:order-none sm:block">{ROLE_LABEL[n.role] ?? n.role}</span>
                <span className="order-1 col-span-2 truncate text-sm text-foreground sm:order-none sm:col-span-1">{n.text}</span>
                <span
                  className={`order-2 justify-self-end text-sm tabular-nums sm:order-none ${released ? "text-muted-foreground/70" : busy ? "font-medium text-(--hire)" : "font-medium text-foreground"}`}
                >
                  {result}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {needs.length > 6 ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          {all ? "Show fewer" : `Show all ${needs.length}`}
        </button>
      ) : null}
    </section>
  );
}
