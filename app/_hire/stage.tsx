"use client";

import { Check, ExternalLink, Loader2, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketAgent, TryoutStep } from "@/lib/market/types";
import { db } from "./db";
import { modelName, outcome, summarize } from "./format";
import { labOf, Logo } from "./logos";
import { ClaimCodes, type Claim, type Estimate, EstimateTable, isEstimate, type LiveNeed, type LiveTryout } from "./proof";

export type HubAgent = Pick<MarketAgent, "id" | "name" | "builder" | "role" | "model">;
export type Site = { title: string; palette: string[]; fonts: { display: string; body: string }; html: string; live_url: string };

const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 } as const;
const OUT = [0.23, 1, 0.32, 1] as const;
const INSERT = "rgb(62 207 142 / 0.22)";

// Every listing on the Hub, so the search can show the whole field it ran over.
export function useHubAgents() {
  const [agents, setAgents] = useState<HubAgent[]>([]);
  useEffect(() => {
    let active = true;
    db()
      .from("market_agents")
      .select("id,name,builder,role,model")
      .then(({ data }) => {
        if (active && data) setAgents(data as HubAgent[]);
      });
    return () => {
      active = false;
    };
  }, []);
  return agents;
}

export function useNow(on: boolean, ms = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [on, ms]);
  return now;
}

export function useCountUp(target: number | null, ms = 700) {
  const [v, setV] = useState(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let id = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return v;
}

// Steps the winner writes after the hire, while it builds the real thing.
export const isDelivery = (s: TryoutStep) => (s.input as { phase?: string } | null)?.phase === "delivery";

// The server's rule: the best score among tryouts that passed every check.
export function bestTryout(tryouts: LiveTryout[]) {
  return (
    tryouts
      .filter((t) => t.status === "scored" && t.checks?.length && t.checks.every((c) => c.passed))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null
  );
}

const at = (iso: string) => new Date(iso).getTime();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Phase = "search" | "tryout" | "build" | "done" | "released";

export function phaseOf(need: LiveNeed, tryouts: LiveTryout[]): Phase {
  if (need.result) return "done";
  const running = tryouts.some((t) => t.status === "running");
  if (!running && (need.status === "waiting" || need.hold?.status === "released")) return "released";
  if (!tryouts.length) return "search";
  return running ? "tryout" : "build";
}

// The dark panel that holds the live work, then the delivered work.
export function StageFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="stage relative min-w-0 overflow-hidden rounded-[22px] text-(--st-1) shadow-[0_2px_4px_rgb(30_20_10/0.12),0_28px_60px_-28px_rgb(30_20_10/0.55)]">
      <div className="relative">{children}</div>
    </section>
  );
}

export function LiveStage({
  need,
  tryouts,
  steps,
  agents,
  hub,
  now,
  winnerId,
}: {
  need: LiveNeed;
  tryouts: LiveTryout[];
  steps: TryoutStep[];
  agents: Map<string, MarketAgent>;
  hub: HubAgent[];
  now: number;
  winnerId: string | null;
}) {
  const phase = phaseOf(need, tryouts);
  const picked = useMemo(() => new Set(tryouts.map((t) => t.agent_id)), [tryouts]);

  // The search gets a beat of its own: the field is scanned, the matches light up, then the tryouts take over.
  // Paced on the wall clock; `now` is the data's clock, which a replay rewinds.
  const wall = useNow(true, 100);
  const [mounted] = useState(() => Date.now());
  const [settledAt, setSettledAt] = useState<number | null>(null);
  const settled = !!need.search && wall - mounted >= 1300;
  if (settled && settledAt == null) setSettledAt(wall);
  const showLanes = tryouts.length > 0 && (phase !== "tryout" || (settledAt != null && wall - settledAt >= 900) || !need.search);

  return (
    <div className="flex min-h-[560px] flex-col p-4 sm:p-5">
      <StageHead phase={showLanes ? phase : "search"} need={need} hub={hub} tryouts={tryouts} />
      <AnimatePresence mode="popLayout" initial={false}>
        {showLanes ? (
          <motion.div
            key="lanes"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: OUT }}
          >
            <Strip hub={hub} need={need} picked={picked} />
            <Lanes tryouts={tryouts} steps={steps} agents={agents} now={now} phase={phase} winnerId={winnerId} />
            {phase === "released" ? (
              <div className="mt-3">
                <ReleasedNote />
              </div>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="field"
            className="flex-1"
            exit={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: OUT }}
          >
            <Field hub={hub} need={need} picked={picked} settled={settled} />
          </motion.div>
        )}
      </AnimatePresence>
      <Ticker steps={steps} tryouts={tryouts} agents={agents} need={need} />
    </div>
  );
}

function StageHead({ phase, need, hub, tryouts }: { phase: Phase; need: LiveNeed; hub: HubAgent[]; tryouts: LiveTryout[] }) {
  const listings = need.search?.listings ?? hub.length;
  const title =
    phase === "search"
      ? "Searching the Hub"
      : phase === "tryout"
        ? "Tryouts, live on your job"
        : phase === "build"
          ? "Hired. Doing the real job"
          : phase === "released"
            ? "Nobody passed every check"
            : "Delivered";
  const sub =
    phase === "search"
      ? `pgvector similarity over ${listings || "every"} listing${listings === 1 ? "" : "s"}`
      : phase === "tryout"
        ? `${tryouts.length} specialists in Vercel Sandbox, every tool call written to Postgres`
        : phase === "build"
          ? "The winner builds the deliverable"
          : phase === "released"
            ? "The hold goes back. Nothing is charged."
            : "";
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={title}
            className="text-[17px] font-semibold tracking-[-0.01em] text-(--st-1)"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: OUT }}
          >
            {title}
          </motion.h2>
        </AnimatePresence>
        <p className="mt-0.5 text-[13px] text-(--st-2)">{sub}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 pt-1 text-(--st-2)">
        <Logo brand="supabase" className="size-4" />
        <Logo brand="vercel" className="size-3.5 text-(--st-1)" />
        <Logo brand="stripe" className="size-4" />
      </div>
    </div>
  );
}

// Every Hub listing as a tile. A scan sweeps while pgvector runs; the matches light up with their similarity.
function Field({ hub, need, picked, settled }: { hub: HubAgent[]; need: LiveNeed; picked: Set<string>; settled: boolean }) {
  const reduce = useReducedMotion();
  const sim = new Map((need.search?.matches ?? []).map((m) => [m.id, m.similarity]));
  const pool: HubAgent[] = hub.length
    ? hub
    : (need.search?.matches ?? []).map((m) => ({ id: m.id, name: m.name, builder: m.builder, role: m.role as HubAgent["role"], model: "" }));
  const order = [...pool].sort((a, b) => hash(a.id + need.id) - hash(b.id + need.id));

  return (
    <div className="relative mt-5 overflow-hidden rounded-2xl">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
        {order.map((a, i) => {
          const s = sim.get(a.id);
          const on = picked.has(a.id);
          const lit = settled && s != null;
          const lab = labOf(a.model);
          return (
            <motion.li
              key={a.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{
                opacity: !settled ? 0.62 : on ? 1 : lit ? 0.9 : 0.22,
                y: 0,
                scale: settled && on ? 1.03 : 1,
              }}
              transition={{ ...SPRING, delay: settled ? (i % 9) * 0.035 : Math.min(i, 60) * 0.008 }}
              className={`flex h-9 min-w-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] ring-1 transition-colors duration-500 ${
                settled && on
                  ? "bg-(--st-blue-soft) text-white ring-(--st-blue)"
                  : lit
                    ? "bg-white/[0.07] text-(--st-1) ring-white/15"
                    : "bg-white/[0.035] text-(--st-2) ring-white/[0.06]"
              }`}
            >
              {lab ? <Logo brand={lab} className="size-3 shrink-0" /> : <span className="size-3 shrink-0 rounded-[4px] bg-white/15" />}
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              {lit ? <span className="shrink-0 font-mono text-[11px] tabular-nums text-(--st-green)">{s.toFixed(2)}</span> : null}
            </motion.li>
          );
        })}
      </ul>
      {!settled && !reduce ? <div aria-hidden className="stage-scan pointer-events-none absolute inset-y-0 left-0 w-1/3" /> : null}
    </div>
  );
}

// The field folded into one line once the tryouts start: every listing a cell, the picked ones lit.
function Strip({ hub, need, picked }: { hub: HubAgent[]; need: LiveNeed; picked: Set<string> }) {
  const matched = new Set((need.search?.matches ?? []).map((m) => m.id));
  const order = [...hub].sort((a, b) => hash(a.id + need.id) - hash(b.id + need.id));
  if (!order.length) return null;
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap gap-[3px]" aria-label={`${order.length} listings searched, ${picked.size} picked`}>
        {order.map((a) => (
          <span
            key={a.id}
            className={`h-2.5 w-2.5 rounded-[3px] ${picked.has(a.id) ? "bg-(--st-blue)" : matched.has(a.id) ? "bg-white/45" : "bg-white/12"}`}
          />
        ))}
      </div>
      <span className="shrink-0 text-[12px] text-(--st-2) tabular-nums">
        {need.search?.listings ?? order.length} searched, {picked.size} picked
      </span>
    </div>
  );
}

function Lanes({
  tryouts,
  steps,
  agents,
  now,
  phase,
  winnerId,
}: {
  tryouts: LiveTryout[];
  steps: TryoutStep[];
  agents: Map<string, MarketAgent>;
  now: number;
  phase: Phase;
  winnerId: string | null;
}) {
  // While they run, the order they started in; once scored, best first.
  const done = !tryouts.some((t) => t.status === "running");
  const lanes = done ? [...tryouts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)) : tryouts;
  return (
    <ul className={`mt-4 grid flex-1 gap-3 ${lanes.length >= 3 ? "lg:grid-cols-3" : lanes.length === 2 ? "lg:grid-cols-2" : ""}`}>
      {lanes.map((t) => (
        <motion.li key={t.id} layout transition={SPRING} className="min-w-0">
          <Lane
            tryout={t}
            agent={agents.get(t.agent_id)}
            steps={steps.filter((s) => s.tryout_id === t.id)}
            now={now}
            state={t.status === "running" ? "running" : t.agent_id === winnerId && phase !== "released" ? "won" : done && winnerId ? "lost" : "scored"}
          />
        </motion.li>
      ))}
    </ul>
  );
}

function Lane({ tryout: t, agent, steps, now, state }: { tryout: LiveTryout; agent?: MarketAgent; steps: TryoutStep[]; now: number; state: "running" | "won" | "lost" | "scored" }) {
  const score = useCountUp(t.status === "scored" ? t.score : null);
  const lab = agent ? labOf(agent.model) : null;
  const ordered = [...steps].sort((a, b) => a.n - b.n);
  const work = ordered.filter((s) => s.kind === "tool" && !isDelivery(s));
  const build = ordered.filter(isDelivery);
  const log = work.slice(state === "won" && build.length ? -3 : -5);
  const last = ordered.length ? at(ordered[ordered.length - 1].created_at) : at(t.created_at);
  const secs = Math.max(0, ((state === "running" ? now : last) - at(t.created_at)) / 1000);
  const passed = t.checks?.filter((c) => c.passed).length ?? 0;

  return (
    <motion.article
      animate={{ opacity: state === "lost" ? 0.5 : 1 }}
      transition={{ duration: 0.5, ease: OUT }}
      className={`flex h-full flex-col rounded-2xl p-3.5 ring-1 transition-[box-shadow,background-color] duration-500 ${
        state === "won"
          ? "bg-(--st-blue-soft) ring-(--st-blue) shadow-[0_0_0_4px_rgb(90_120_255/0.14),0_18px_40px_-18px_rgb(60_90_255/0.6)]"
          : "bg-white/[0.045] ring-white/[0.08]"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-white">{agent?.name ?? "Specialist"}</span>
            <AnimatePresence>
              {state === "won" ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 520, damping: 22 }}
                  className="rounded-md bg-(--st-blue) px-1.5 py-0.5 text-[11px] font-semibold text-white"
                >
                  Hired
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-(--st-2)" title={agent ? `by ${agent.builder}` : undefined}>
            {lab ? <Logo brand={lab} className="size-3 shrink-0" /> : null}
            <span className="truncate">{agent ? modelName(agent.model) : ""}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {state === "running" ? (
            <div className="flex items-center gap-1.5 text-[12px] text-(--st-2) tabular-nums">
              <Loader2 className="size-3.5 animate-spin text-(--st-blue-text)" />
              {secs.toFixed(1)} s
            </div>
          ) : t.status === "scored" ? (
            <div className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-white tabular-nums">
              {score.toFixed(1)}
              <span className="ml-0.5 text-[11px] font-normal tracking-normal text-(--st-3)">/10</span>
            </div>
          ) : (
            <span className="text-[13px] text-(--st-red)">Failed</span>
          )}
        </div>
      </header>

      <ol className="mt-3 flex-1 space-y-1">
        <AnimatePresence initial={false}>
          {log.map((s) => (
            <motion.li
              key={s.id}
              layout="position"
              initial={{ opacity: 0, y: 10, backgroundColor: INSERT }}
              animate={{ opacity: 1, y: 0, backgroundColor: "rgb(62 207 142 / 0)" }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.35, ease: OUT, backgroundColor: { duration: 1.4, ease: "easeOut" } }}
              className="rounded-lg px-2 py-1 text-[12px] leading-snug"
            >
              <span className="font-mono text-[11.5px] text-(--st-green)">{s.name}</span>
              <span className="text-(--st-1)"> {summarize(s.name, s.input)}</span>
              {outcome(s.name, s.output) ? <span className="block truncate text-(--st-2)">{outcome(s.name, s.output)}</span> : null}
            </motion.li>
          ))}
        </AnimatePresence>
        {!log.length ? (
          <li className="flex items-center gap-2 px-2 py-1 text-[12px] text-(--st-2)">
            <Loader2 className="size-3.5 animate-spin" /> Booting in a sandbox
          </li>
        ) : null}
      </ol>

      {build.length ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-[12px] font-medium text-(--st-blue-text)">Doing the real job</p>
          <ol className="mt-1.5 space-y-1">
            <AnimatePresence initial={false}>
              {build.map((s) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: OUT }}
                  className="flex items-center gap-2 text-[12.5px] text-white"
                >
                  <Check className="size-3.5 shrink-0 text-(--st-green)" strokeWidth={3} />
                  <span className="font-mono text-[11.5px] text-(--st-green)">{s.name}</span>
                  <span className="min-w-0 truncate text-(--st-1)">{buildLine(s)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      ) : null}

      <footer className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
        {t.checks?.length ? (
          <>
            <div className="flex flex-1 gap-1">
              {t.checks.map((c, i) => (
                <motion.span
                  key={c.name}
                  title={c.name}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3, ease: OUT, delay: i * 0.07 }}
                  className={`h-1.5 flex-1 origin-left rounded-full ${c.passed ? "bg-(--st-green)" : "bg-(--st-red)"}`}
                />
              ))}
            </div>
            <span className={`text-[12px] tabular-nums ${passed === t.checks.length ? "text-(--st-green)" : "text-(--st-2)"}`}>
              {passed}/{t.checks.length} checks
            </span>
          </>
        ) : (
          <span className="text-[12px] text-(--st-3) tabular-nums">
            {work.length} tool {work.length === 1 ? "call" : "calls"}
          </span>
        )}
      </footer>
    </motion.article>
  );
}

// One plain line for a step of the real job: "6 photos placed".
function buildLine(s: TryoutStep) {
  const o = (s.output ?? {}) as Record<string, unknown>;
  if (Array.isArray(o.sections)) return `${o.sections.length} sections, one file`;
  if (typeof o.placed === "number") return `${o.placed} photos placed`;
  if (typeof o.headline === "string") return o.headline;
  if (o.status === "live") return "Live";
  const rest = { ...((s.input ?? {}) as Record<string, unknown>) };
  delete rest.phase;
  return summarize(s.name, rest);
}

// Supabase Realtime, as it lands: every tool call is a row.
function Ticker({ steps, tryouts, agents, need }: { steps: TryoutStep[]; tryouts: LiveTryout[]; agents: Map<string, MarketAgent>; need: LiveNeed }) {
  const latest = steps.reduce<TryoutStep | null>((m, s) => (!m || at(s.created_at) >= at(m.created_at) ? s : m), null);
  const who = latest ? agents.get(tryouts.find((t) => t.id === latest.tryout_id)?.agent_id ?? "")?.name : null;
  const rows = steps.length + tryouts.length + (need.search ? 1 : 0);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 text-[12px] ring-1 ring-white/[0.06]">
      <Logo brand="supabase" className="size-3.5 shrink-0" />
      <span className="shrink-0 font-medium text-(--st-1)">Realtime</span>
      <span className="shrink-0 text-(--st-2) tabular-nums">{rows} rows</span>
      <div className="relative h-4 min-w-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={latest?.id ?? (need.search ? "search" : "none")}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.3, ease: OUT }}
            className="absolute inset-0 truncate font-mono text-[11.5px] text-(--st-2)"
          >
            {latest ? (
              <>
                <span className="text-(--st-green)">INSERT</span> tryout_steps · {who ?? "agent"} · {latest.name}
              </>
            ) : need.search ? (
              <>
                <span className="text-(--st-green)">UPDATE</span> needs.search · {need.search.matches?.length ?? 0} matches
              </>
            ) : (
              <>
                <span className="text-(--st-green)">INSERT</span> needs · {need.role}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function isSite(o: unknown): o is Site {
  return !!o && typeof o === "object" && typeof (o as Site).html === "string";
}

export function DeliveredStage({ result, onReplay }: { result: NonNullable<LiveNeed["result"]>; onReplay?: () => void }) {
  const out = result.output as Estimate | Claim | Site | null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: OUT }} className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold tracking-[-0.01em] text-white">
          <Check className="size-4 shrink-0 text-(--st-green)" strokeWidth={3} />
          <span className="truncate">Delivered by {result.agent_name}</span>
        </h2>
        {onReplay ? (
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-(--st-2) ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <RotateCcw className="size-3.5" /> Replay the tryout
          </button>
        ) : null}
      </div>
      {isSite(out) ? (
        <SitePreview site={out} />
      ) : out ? (
        <div className="mt-4 rounded-2xl bg-white p-5 text-stone-900">{isEstimate(out as Estimate | Claim) ? <EstimateTable e={out as Estimate} /> : <ClaimCodes c={out as Claim} />}</div>
      ) : null}
      {result.reply ? <Reply text={result.reply} /> : null}
    </motion.div>
  );
}

function Reply({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <p className={`text-[14px] leading-relaxed text-pretty whitespace-pre-line text-(--st-1) ${open ? "" : "line-clamp-3"}`}>{bold(text)}</p>
      {text.length > 220 ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[13px] text-(--st-blue-text) hover:underline">
          {open ? "Show less" : "Read the whole reply"}
        </button>
      ) : null}
    </div>
  );
}

// Replies arrive as light markdown: keep **bold**, drop the markers.
export function bold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold">{part}</strong> : part));
}

const SITE_W = 1280;

function SitePreview({ site }: { site: Site }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = w ? w / SITE_W : 0.5;
  const h = Math.round((w || 640) * 0.62);
  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-white/10 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.7)]">
        <div className="flex items-center gap-2 bg-[oklch(0.93_0.005_75)] px-3 py-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-black/15" />
            <span className="size-2.5 rounded-full bg-black/15" />
            <span className="size-2.5 rounded-full bg-black/15" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-center text-[11px] text-stone-500">{site.live_url ? site.live_url.replace(/^https?:\/\//, "") : site.title}</span>
        </div>
        <div ref={ref} className="relative overflow-hidden bg-white" style={{ height: h }}>
          {w ? (
            <iframe
              title={site.title}
              srcDoc={site.html}
              sandbox="allow-scripts"
              className="absolute top-0 left-0 origin-top-left border-0"
              style={{ width: SITE_W, height: h / scale, transform: `scale(${scale})` }}
            />
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-white">{site.title}</div>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-(--st-2)">
            <span className="flex">
              {site.palette.map((c) => (
                <span key={c} className="-ml-1 size-4 rounded-full ring-2 ring-(--st-bg) first:ml-0" style={{ background: c }} />
              ))}
            </span>
            {site.fonts.display} and {site.fonts.body}
          </div>
        </div>
        {site.live_url ? (
          <a
            href={site.live_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-semibold text-stone-900 transition-transform duration-150 ease-out hover:bg-stone-100 active:scale-[0.97]"
          >
            Open the live site <ExternalLink className="size-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function ReleasedNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.05] px-3.5 py-3 text-[13px] text-(--st-1) ring-1 ring-white/[0.08]">
      <X className="mt-0.5 size-4 shrink-0 text-(--st-red)" />
      No specialist passed every check, so nobody was hired and the hold was released.
    </div>
  );
}
