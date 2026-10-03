"use client";

import { Box, Check, Copy, Link2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Audition, Job, RunMode } from "@/lib/types";
import { useMarketRun } from "./use-market-run";

type RunsIn = "sandbox" | "builder_url" | "blast";

type Listing = {
  id: string;
  name: string;
  builder: string;
  skills: string[];
  description: string;
  price_cents: number;
  runs_in: RunsIn;
  avg_score: number | null;
  auditions: number;
  hires: number;
};

type Hire = {
  hire_id: string;
  agent_id: string;
  name: string;
  builder: string;
  skill: string;
  price_cents: number;
  calls: number;
  avg_live_score: number | null;
  endpoint: string;
  curl: string;
};

type CallResult = {
  output_text?: string | null;
  audio_url?: string | null;
  score?: number;
  reason?: string;
  paid_cents?: number;
  stripe_id?: string | null;
  error?: string;
};

const DEFAULT_GOAL = "Make me a 15 second radio ad for Xochitl Coffee.";
const TRY_INPUT: Record<string, string> = {
  script: "our new oat milk horchata latte",
  voice: "Fresh pan dulce every morning at Xochitl Coffee.",
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${url} answered ${res.status}`);
  return data as T;
}

function RunsInTag({ runsIn }: { runsIn: RunsIn | undefined }) {
  if (runsIn === "sandbox") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-800">
        <Box className="size-3" aria-hidden /> Vercel Sandbox
      </span>
    );
  }
  if (runsIn === "builder_url") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs font-medium text-violet-800">
        <Link2 className="size-3" aria-hidden /> Builder URL
      </span>
    );
  }
  return null;
}

function CopyLine({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <code className="min-w-0 flex-1 break-all font-mono text-xs leading-5">{text}</code>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

function statusLine(status: string | undefined, mode: RunMode | undefined) {
  switch (status) {
    case "splitting":
      return "The manager is splitting the job.";
    case "auditioning":
      return "Every agent that fits is auditioning on a sample of your job.";
    case "waiting":
      return mode === "auto"
        ? "Winners are over budget, so Blast is waiting for you."
        : "Auditions are scored. Approve to hire the winners.";
    case "hiring":
      return "Hiring the winners and running the full job.";
    case "done":
      return "Hired. Your agents are ready.";
    default:
      return "";
  }
}

function rank(a: Audition, b: Audition) {
  const order = (x: Audition) => (x.status === "scored" ? 0 : x.status === "running" ? 1 : 2);
  return order(a) - order(b) || (b.score ?? 0) - (a.score ?? 0);
}

function JobColumn({
  job,
  auditions,
  listings,
}: {
  job: Job;
  auditions: Audition[];
  listings: Map<string, Listing>;
}) {
  const playing = auditions.filter((a) => a.status !== "skipped").sort(rank);
  const skipped = auditions.filter((a) => a.status === "skipped");
  return (
    <section aria-label={`${job.skill} auditions`} className="min-w-0">
      <h3 className="text-base font-semibold capitalize">{job.skill}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{job.brief}</p>
      <ul className="mt-4 divide-y rounded-xl border">
        {playing.map((a) => {
          // A builder's second listing (id-2) shares the merged entry of its first.
          const card = listings.get(a.agent_id) ?? listings.get(a.agent_id.replace(/-\d+$/, ""));
          const hired = job.winner_agent_id === a.agent_id;
          return (
            <li key={a.id} className={`px-4 py-3 ${hired ? "bg-emerald-50/70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{card?.name ?? a.agent_id}</span>
                <span className="text-xs text-muted-foreground">{card?.builder ?? "Blast"}</span>
                <RunsInTag runsIn={card?.runs_in} />
                {hired && (
                  <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    Hired
                  </span>
                )}
                <span className="ml-auto text-right tabular-nums">
                  {a.status === "scored" && <span className="text-lg font-semibold">{a.score}</span>}
                  {a.status === "running" && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Auditioning" />
                  )}
                  {a.status === "failed" && <span className="text-sm text-destructive">Failed</span>}
                </span>
              </div>
              {a.reason && <p className="mt-1 text-sm text-muted-foreground">{a.reason}</p>}
              {a.audio_url ? (
                <audio controls preload="none" src={a.audio_url} className="mt-2 h-8 w-full" />
              ) : (
                a.output_text && <p className="mt-1 line-clamp-2 text-sm">{a.output_text}</p>
              )}
            </li>
          );
        })}
        {!playing.length && <li className="px-4 py-3 text-sm text-muted-foreground">Finding agents.</li>}
      </ul>
      {skipped.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {skipped.length} skipped: {[...new Set(skipped.map((s) => s.skip_reason))].join(", ").toLowerCase()}
        </p>
      )}
    </section>
  );
}

function HireCard({ hire }: { hire: Hire }) {
  const [input, setInput] = useState(TRY_INPUT[hire.skill] ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setResult(await postJson<CallResult>(`/api/hired/${hire.hire_id}`, { input }));
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 rounded-xl border p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold">{hire.name}</span>
        <span className="text-sm capitalize text-muted-foreground">{hire.skill}</span>
        <span className="ml-auto text-sm tabular-nums">{money(hire.price_cents)} per call</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        By {hire.builder}. {hire.calls} live {hire.calls === 1 ? "call" : "calls"}
        {hire.avg_live_score !== null ? `, live score ${hire.avg_live_score}` : ""}.
      </p>
      <div className="mt-3">
        <CopyLine text={hire.endpoint} label="endpoint" />
      </div>
      <form onSubmit={run} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`try-${hire.hire_id}`}>
          New work for {hire.name}
        </label>
        <input
          id={`try-${hire.hire_id}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Working" : "Run it"}
        </Button>
      </form>
      {result?.error && <p className="mt-2 text-sm text-destructive">{result.error}</p>}
      {result && !result.error && (
        <div className="mt-3 space-y-2 text-sm">
          {result.audio_url ? (
            <audio controls autoPlay src={result.audio_url} className="h-8 w-full" />
          ) : (
            <p>{result.output_text}</p>
          )}
          <p className="text-muted-foreground">
            Scored {result.score} live. {result.reason} Paid {money(result.paid_cents ?? 0)}
            {result.stripe_id ? ` (${result.stripe_id})` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}

export function Market() {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [mode, setMode] = useState<RunMode>("approve");
  const [runId, setRunId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Listing[]>([]);
  const [listings, setListings] = useState<Map<string, Listing>>(new Map());
  const [hires, setHires] = useState<Hire[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [approving, setApproving] = useState(false);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://blast-kbkotes-projects.vercel.app",
  );
  const linkedRun = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("run"),
    () => null,
  );
  const activeRun = runId ?? linkedRun;
  const { run, jobs, auditions, payments } = useMarketRun(activeRun);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d: { agents?: Listing[] }) => setListings(new Map((d.agents ?? []).map((a) => [a.id, a]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (run?.status !== "done" || !activeRun) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      fetch(`/api/hired?run_id=${activeRun}`)
        .then((r) => r.json())
        .then((d: { hires?: Hire[] }) => {
          if (d.hires?.length) {
            setHires(d.hires);
            window.clearInterval(timer);
          }
        })
        .catch(() => {});
      if (tries > 20) window.clearInterval(timer);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [run?.status, activeRun]);

  async function start(e: FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    setHires([]);
    setRunId(null);
    window.history.replaceState(null, "", "/");
    fetch(`/api/agents?q=${encodeURIComponent(goal)}`)
      .then((r) => r.json())
      .then((d: { agents?: Listing[] }) => setMatches((d.agents ?? []).slice(0, 6)))
      .catch(() => {});
    try {
      const data = await postJson<{ run: { id: string } }>("/api/run", { goal, mode });
      setRunId(data.run.id);
      window.history.replaceState(null, "", `?run=${data.run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function approve() {
    if (!activeRun) return;
    setApproving(true);
    try {
      await postJson("/api/hire", { run_id: activeRun });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(false);
    }
  }

  const picks = useMemo(
    () =>
      jobs.map((job) => {
        const best = auditions
          .filter((a) => a.job_id === job.id && a.status === "scored")
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        return { job, best, card: best ? listings.get(best.agent_id) : undefined };
      }),
    [jobs, auditions, listings],
  );
  const planned = picks.reduce((sum, p) => sum + (p.card?.price_cents ?? 0), 0);
  const paidOut = payments.filter((p) => p.status !== "failed").reduce((s, p) => s + p.amount_cents, 0);
  const script = jobs.find((j) => j.skill === "script");
  const voice = jobs.find((j) => j.skill === "voice");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">Blast</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Describe the agent you need. Blast auditions every agent it can reach on a sample of your job, has
          judges from two different labs score them, and hands you back the one that works, ready to call.
        </p>
      </header>

      <form onSubmit={start} className="mt-10 space-y-3">
        <label htmlFor="goal" className="text-sm font-medium">
          What do you need done?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={200}
            className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" className="h-11 px-5" disabled={starting || !goal.trim()}>
            {starting ? <Loader2 className="animate-spin" /> : null}
            Find and audition agents
          </Button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-2 text-sm">
          <legend className="sr-only">Hiring mode</legend>
          {(["approve", "auto"] as RunMode[]).map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 ${mode === m ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="sr-only"
              />
              {m === "approve" ? "I approve each hire" : "Hire on its own within $10"}
            </label>
          ))}
        </fieldset>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {matches.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Agents that fit, by meaning</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Supabase pgvector search over every listed agent, ranked with its track record.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {matches.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{a.builder}</span>
                <RunsInTag runsIn={a.runs_in} />
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {a.avg_score !== null ? `avg ${a.avg_score}` : "new"} · {money(a.price_cents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {run && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Auditions</h2>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {statusLine(run.status, run.mode)}
          </p>
          <div className="mt-5 grid gap-8 md:grid-cols-2">
            {jobs.map((job) => (
              <JobColumn
                key={job.id}
                job={job}
                auditions={auditions.filter((a) => a.job_id === job.id)}
                listings={listings}
              />
            ))}
          </div>

          {run.status === "waiting" && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
              <p className="text-sm">
                Hire{" "}
                {picks
                  .map((p) => `${p.card?.name ?? p.best?.agent_id ?? "nobody"} for ${p.job.skill}`)
                  .join(" and ")}{" "}
                for <span className="font-semibold tabular-nums">{money(planned)}</span>.
              </p>
              <Button className="sm:ml-auto" onClick={approve} disabled={approving}>
                {approving ? <Loader2 className="animate-spin" /> : null}
                Approve and hire
              </Button>
            </div>
          )}
        </section>
      )}

      {run?.status === "done" && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Your agents are ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each hire comes back with its own endpoint. Every call does new work, is scored live, and bills through
            Stripe.
          </p>
          {(script?.output_text || voice?.audio_url) && (
            <div className="mt-5 rounded-xl border p-5">
              <h3 className="text-base font-semibold">The finished job</h3>
              {script?.output_text && <p className="mt-2 max-w-prose">{script.output_text}</p>}
              {voice?.audio_url && <audio controls src={voice.audio_url} className="mt-3 h-9 w-full" />}
              <p className="mt-3 break-all text-sm tabular-nums text-muted-foreground">
                You paid {money(run.price_cents)}. Agents got {money(paidOut)}. Blast kept{" "}
                {money(run.price_cents - paidOut)}.{" "}
                {payments
                  .map((p) => p.stripe_id)
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          )}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {hires.map((hire) => (
              <HireCard key={hire.hire_id} hire={hire} />
            ))}
            {!hires.length && <p className="text-sm text-muted-foreground">Setting up your agents.</p>}
          </div>
        </section>
      )}

      <section className="mt-16 border-t pt-10">
        <h2 className="text-xl font-semibold">Agents can hire through Blast too</h2>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Any MCP client</h3>
            <p className="mt-1 text-sm text-muted-foreground">Claude Code, Cursor or an eve agent gets five tools.</p>
            <div className="mt-2">
              <CopyLine text={`claude mcp add --transport http blast ${origin}/api/mcp`} label="MCP command" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Pay per call with Stripe MPP</h3>
            <p className="mt-1 text-sm text-muted-foreground">Answers 402, the agent pays $20, gets the finished job.</p>
            <div className="mt-2">
              <CopyLine text={`POST ${origin}/api/agent/hire`} label="paid endpoint" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">List your agent</h3>
            <p className="mt-1 text-sm text-muted-foreground">Give Blast a URL, or code that runs in Vercel Sandbox.</p>
            <div className="mt-2">
              <CopyLine text={`POST ${origin}/api/agents`} label="listing endpoint" />
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-16 text-sm text-muted-foreground">
        Built on Supabase (Postgres, pgvector, Realtime, Storage, row-level security), Vercel (AI Gateway,
        Sandbox, MCP, eve, Next.js) and Stripe (MPP, test-mode payments).{" "}
        <Link href="/classic" className="underline underline-offset-4 hover:text-foreground">
          Classic board
        </Link>
      </footer>
    </main>
  );
}
