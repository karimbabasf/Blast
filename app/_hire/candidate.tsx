"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import type { MarketAgent, TryoutStep } from "@/lib/market/types";
import { AgentAvatar } from "../_components/agent-avatar";
import { scoreTone } from "../_components/score-tone";
import { modelName, money, ROLE_TOOLS, summarize, toolLabel } from "./format";
import type { LiveTryout } from "./proof";

// Every card is this tall, so nothing below ever moves.
const CARD_HEIGHT = "h-[15.5rem]";

const SHORT_MODEL = /^(Claude|Gemini) /;

export function Candidate({
  agent,
  rank,
  tryout,
  steps,
  winner,
  leading,
}: {
  agent: MarketAgent;
  rank: number | null;
  tryout: LiveTryout | null;
  steps: TryoutStep[];
  winner: boolean;
  leading: boolean;
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
      className={`${CARD_HEIGHT} relative flex flex-col gap-3 overflow-hidden rounded-2xl p-3.5 text-card-foreground ring-1 transition-[box-shadow,background-color] duration-200 ease-out ${
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
        <Stat label="Per job" tone="" value={money(agent.price_action_cents)} />
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
      <p className="flex h-5 items-center gap-1.5 text-sm">
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

    </article>
  );
}

// A number first, its label under it. A missing value keeps the tile's size.
function Stat({ label, value, tone }: { label: string; value: string | null; tone: string }) {
  return (
    <div className={`flex h-13 flex-col justify-center rounded-xl px-2 transition-colors duration-200 ease-out ${tone || "bg-muted/60"}`}>
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
