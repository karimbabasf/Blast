"use client";

import { Bot, Check, ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db, postJson } from "./db";
import { clock, money, outcome, summarize } from "./format";
import { capturedCents, type LiveNeed, stripeLinks, workLine } from "./proof";
import { useNeed } from "./use-need";

type Row = LiveNeed;

const STATUS: Record<string, string> = {
  auditioning: "Trying out",
  checkout: "Doing the job",
  hired: "Done",
  waiting: "Nobody passed",
};

async function load() {
  const s = db();
  const { data } = await s
    .from("needs")
    .select("*")
    .eq("source", "claude-code")
    .order("created_at", { ascending: false })
    .limit(50);
  const needs = (data ?? []) as Row[];
  const ids = [...new Set(needs.map((n) => n.result?.agent_id ?? n.hold?.agent_id).filter((x): x is string => !!x))];
  const builders: Record<string, string> = {};
  if (ids.length) {
    const { data: agents } = await s.from("market_agents").select("id,builder").in("id", ids);
    for (const a of (agents ?? []) as { id: string; builder: string }[]) builders[a.id] = a.builder;
  }
  return { needs, builders };
}

export function Hires() {
  const [data, setData] = useState<{ needs: Row[]; builders: Record<string, string> } | null>(null);

  // Realtime refreshes on any change to a need; a slow poll covers a dropped socket.
  useEffect(() => {
    let active = true;
    const refresh = () =>
      load()
        .then((next) => {
          if (active) setData(next);
        })
        .catch(() => {});
    const channel = db()
      .channel("my-hires")
      .on("postgres_changes", { event: "*", schema: "public", table: "needs" }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 5000);
    refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
      db().removeChannel(channel);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My hires</h1>
      <p className="mt-1 text-sm text-muted-foreground">Specialists Claude Code hired for you over MCP, with the work and the payment.</p>
      <Policy />

      {!data ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading
        </div>
      ) : !data.needs.length ? (
        <p className="mt-8 text-muted-foreground">No hires yet. Ask Claude Code to hire a specialist.</p>
      ) : (
        <>
          {data.needs
            .filter((n) => ACTIVE.has(n.status))
            .map((n) => (
              <Working key={n.id} need={n} />
            ))}
          {data.needs.some((n) => !ACTIVE.has(n.status)) ? (
            <ul className="mt-6 divide-y rounded-xl border bg-card">
              {data.needs
                .filter((n) => !ACTIVE.has(n.status))
                .map((n) => (
                  <HireRow key={n.id} need={n} builder={data.builders[n.result?.agent_id ?? n.hold?.agent_id ?? ""]} />
                ))}
            </ul>
          ) : null}
        </>
      )}
    </main>
  );
}

function HireRow({ need: n, builder }: { need: Row; builder?: string }) {
  const h = n.hold;
  const work = workLine(n.result?.output);
  const day = new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <li className="relative grid gap-x-6 gap-y-2 p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,16rem)]">
      <div className="text-sm text-muted-foreground tabular-nums">
        <div>{clock(n.created_at)}</div>
        <div className="text-xs">{day}</div>
      </div>

      <div className="min-w-0">
        <Link href={`/?need=${n.id}`} className="line-clamp-2 font-medium after:absolute after:inset-0">
          {n.text}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={`rounded-full px-2 py-0.5 text-xs ${n.status === "hired" ? "bg-success/15 text-success" : n.status === "waiting" ? "bg-muted text-muted-foreground" : "bg-(--hire-soft) text-(--hire)"}`}>
            {STATUS[n.status] ?? n.status}
          </span>
          {n.result?.agent_name ? (
            <span className="inline-flex items-center gap-1">
              <Bot className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{n.result.agent_name}</span>
              {builder ? <span className="text-muted-foreground">by {builder}</span> : null}
            </span>
          ) : null}
        </div>
        {work ? <p className="mt-1 truncate text-sm text-muted-foreground">{work}</p> : null}
      </div>

      <div className="text-sm tabular-nums sm:text-right">
        {!h?.payment_intent ? (
          <span className="text-muted-foreground">No payment yet</span>
        ) : (
          <>
            <div className="font-medium">
              {h.status === "captured"
                ? `${money(capturedCents(h))} captured of ${money(h.amount_cents)} held`
                : h.status === "released"
                  ? `${money(h.amount_cents)} released, nothing charged`
                  : `${money(h.amount_cents)} held`}
            </div>
            <div className="relative z-10 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:justify-end">
              <StripeLink href={stripeLinks.payment(h.payment_intent)}>{h.payment_intent}</StripeLink>
              {h.transfer ? <StripeLink href={stripeLinks.transfer(h.transfer)}>{h.transfer}</StripeLink> : null}
            </div>
            {h.via === "mpp" ? <div className="mt-1 text-xs text-muted-foreground">Paid over MPP</div> : null}
          </>
        )}
      </div>
    </li>
  );
}

// The standing approval: lets Claude Code hire within one hold without asking.
export function Policy({ compact = false }: { compact?: boolean }) {
  const [cents, setCents] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch("/api/policy")
        .then((r) => r.json())
        .then((d: { auto_approve_cents?: number }) => {
          if (active) setCents(d.auto_approve_cents ?? 0);
        })
        .catch(() => {});
    const channel = db()
      .channel("spend-policy")
      .on("postgres_changes", { event: "*", schema: "public", table: "spend_policy" }, refresh)
      .subscribe();
    refresh();
    return () => {
      active = false;
      db().removeChannel(channel);
    };
  }, []);

  const on = (cents ?? 0) > 0;
  const cap = money(on ? (cents ?? 0) : 4000);

  async function flip() {
    setBusy(true);
    setError(null);
    try {
      const d = await postJson<{ auto_approve_cents: number }>("/api/policy", { auto_approve: !on });
      setCents(d.auto_approve_cents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the setting");
    } finally {
      setBusy(false);
    }
  }

  if (compact)
    return (
      <div className="flex items-center gap-2.5 text-sm">
        <span className="hidden text-right leading-tight sm:block">
          <span className="block font-medium text-foreground tabular-nums">{on ? `Auto-hire up to ${cap}` : "Ask before hiring"}</span>
          <span className="block text-xs text-muted-foreground">{on ? "Agents hire without asking" : "Agents ask you first"}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`Auto-hire up to ${cap} per job`}
          disabled={busy || cents == null}
          onClick={flip}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:cursor-wait ${on ? "bg-(--hire)" : "bg-secondary"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-white  transition-transform duration-200 ease-out motion-reduce:transition-none ${on ? "translate-x-5.5" : "translate-x-0.5"}`} />
        </button>
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );

  return (
    <div className="mt-5 flex items-start gap-3 rounded-xl border bg-card p-4">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="policy-label"
        disabled={busy || cents == null}
        onClick={flip}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:opacity-60 ${
          on ? "bg-(--hire)" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white  transition-transform duration-200 ease-out motion-reduce:transition-none ${
            on ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="min-w-0">
        <p id="policy-label" className="font-medium">
          Let my agents hire without asking, up to {cap} per job
        </p>
        {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

const ACTIVE = new Set(["auditioning", "checkout"]);

const STAGES = ["Found (semantic search)", "Auditioning on your job", "Winner picked", "Paid on proof"];

// A hire in progress: the four stages, then one lane per auditioning agent with its tool calls as they land.
function Working({ need }: { need: Row }) {
  const view = useNeed(need.id);
  const n = (view.need as Row | null) ?? need;
  const { tryouts, steps } = view;
  const names = new Map(view.agents.map((a) => [a.id, a.name]));
  const done = [
    !!n.search || tryouts.length > 0,
    tryouts.length > 0 && !tryouts.some((t) => t.status === "running"),
    n.status === "checkout" || n.status === "hired" || !!n.result,
    n.hold?.status === "captured",
  ];
  const current = done.indexOf(false);

  return (
    <Link href={`/?need=${n.id}`} className="mt-6 block rounded-xl border border-(--hire)/50 bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="line-clamp-2 max-w-3xl text-lg font-medium">{n.text}</p>
        <span className="text-sm text-muted-foreground tabular-nums">{clock(n.created_at)}</span>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((label, i) => {
          const on = done[i];
          const now = i === current;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-300 ease-out ${
                on ? "border-(--hire)/40 bg-(--hire-soft) text-(--hire)" : now ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {on ? (
                <Check className="size-4 shrink-0" />
              ) : (
                <span className={`size-2 shrink-0 rounded-full ${now ? "bg-(--hire) animate-pulse motion-reduce:animate-none" : "bg-muted-foreground/30"}`} />
              )}
              {label}
            </li>
          );
        })}
      </ol>

      {tryouts.length ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
          {tryouts.map((t) => {
            const lane = steps.filter((s) => s.tryout_id === t.id && s.kind === "tool").slice(-5);
            const passed = t.checks?.length ? t.checks.every((c) => c.passed) : false;
            return (
              <div key={t.id} className="rounded-lg bg-muted/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{names.get(t.agent_id) ?? "Specialist"}</span>
                  {t.status === "running" ? (
                    <span className="size-2 shrink-0 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" aria-label="working" />
                  ) : t.status === "scored" ? (
                    <span className="flex items-center gap-1 text-sm tabular-nums">
                      {t.score?.toFixed(1)}
                      {passed ? <Check className="size-4 text-success" /> : <X className="size-4 text-destructive" />}
                    </span>
                  ) : (
                    <X className="size-4 text-destructive" aria-label="failed" />
                  )}
                </div>
                <ol className="mt-2 space-y-1 font-mono text-sm leading-snug">
                  {lane.map((s) => (
                    <li key={s.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none">
                      <span className="text-(--hire)">{s.name}</span> {summarize(s.name, s.input)}
                      {outcome(s.name, s.output) ? <span className="text-muted-foreground"> -&gt; {outcome(s.name, s.output)}</span> : null}
                    </li>
                  ))}
                  {!lane.length ? <li className="text-muted-foreground">Starting</li> : null}
                </ol>
              </div>
            );
          })}
        </div>
      ) : null}
    </Link>
  );
}

function StripeLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 font-mono text-(--hire) hover:underline">
      <span className="truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}
