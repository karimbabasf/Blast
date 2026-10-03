"use client";

import { ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { scoreTone } from "../_components/score-tone";
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

const ACTIVE = new Set(["auditioning", "checkout"]);

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

  const needs = data?.needs ?? [];
  const live = needs.filter((n) => ACTIVE.has(n.status));
  const past = needs.filter((n) => !ACTIVE.has(n.status));
  const captured = needs.filter((n) => n.hold?.status === "captured");
  const stats = [
    { label: "Hires", value: data ? String(needs.length) : null, tone: "" },
    { label: "Paid on proof", value: data ? String(captured.length) : null, tone: captured.length ? "bg-success/10 text-success" : "" },
    { label: "Captured", value: data ? money(captured.reduce((a, n) => a + (n.hold ? capturedCents(n.hold) : 0), 0)) : null, tone: "" },
    {
      label: "Released",
      value: data ? money(needs.reduce((a, n) => a + (n.hold?.status === "released" ? n.hold.amount_cents : 0), 0)) : null,
      tone: "",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-block-dark p-6 text-white">
        <div>
          <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">My Hires</h1>
          <p className="mt-1 text-sm text-white/70">Specialists Claude Code hired for you, with the work and the payment.</p>
        </div>
        <Policy />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`flex h-20 flex-col justify-center rounded-2xl px-4 ${s.tone || "bg-muted"}`}>
            <dd className="h-8 text-2xl leading-8 font-semibold tabular-nums">
              {s.value ?? <span className="animate-pulse text-muted-foreground/50">…</span>}
            </dd>
            <dt className="text-xs opacity-70">{s.label}</dt>
          </div>
        ))}
      </dl>

      {live.map((n) => (
        <Working key={n.id} need={n} />
      ))}

      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Loading…
        </p>
      ) : !needs.length ? (
        <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground">No hires yet. Ask Claude Code to hire a specialist.</p>
      ) : past.length ? (
        <ul className="divide-y rounded-2xl ring-1 ring-foreground/10">
          {past.map((n, index) => (
            <HireRow key={n.id} need={n} order={index} builder={data.builders[n.result?.agent_id ?? n.hold?.agent_id ?? ""]} />
          ))}
        </ul>
      ) : null}
      <LogoFactory ids={[...new Set(needs.map((n) => n.result?.agent_id).filter((x): x is string => !!x))]} />
    </main>
  );
}

function HireRow({ need: n, builder, order }: { need: Row; builder?: string; order: number }) {
  const h = n.hold;
  const work = workLine(n.result?.output);
  const day = new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <li
      style={{ animationDelay: `${Math.min(order, 12) * 30}ms` }}
      className="relative grid animate-in items-center gap-x-5 gap-y-2 p-4 transition-colors duration-150 ease-out fade-in fill-mode-backwards slide-in-from-bottom-1 hover:bg-muted/50 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,15rem)]"
    >
      <div className="text-sm text-muted-foreground tabular-nums">
        <div className="font-medium text-foreground">{clock(n.created_at)}</div>
        <div className="text-xs">{day}</div>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {n.result?.agent_id ? (
          <AgentAvatar card={{ id: n.result.agent_id, name: n.result.agent_name }} size="md" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <X aria-hidden="true" className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold" translate="no">
              {n.result?.agent_name ?? "Nobody hired"}
            </span>
            {builder ? <span className="truncate text-xs text-muted-foreground">{builder}</span> : null}
            <span
              className={`shrink-0 rounded-full px-2 py-px text-xs font-medium ${
                n.status === "hired" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {STATUS[n.status] ?? n.status}
            </span>
          </div>
          <Link href={`/?need=${n.id}`} className="block truncate text-sm text-muted-foreground after:absolute after:inset-0">
            {n.text}
          </Link>
          {work ? <p className="truncate text-sm font-medium">{work}</p> : null}
        </div>
      </div>

      <div className="text-sm tabular-nums sm:text-right">
        {!h?.payment_intent ? (
          <span className="text-muted-foreground">No payment</span>
        ) : (
          <>
            <div>
              {h.status === "captured" ? (
                <>
                  <span className="text-lg font-semibold text-success">{money(capturedCents(h))}</span>
                  <span className="text-muted-foreground"> of {money(h.amount_cents)} held</span>
                </>
              ) : h.status === "released" ? (
                <span className="text-muted-foreground">{money(h.amount_cents)} released</span>
              ) : (
                <span className="font-semibold">{money(h.amount_cents)} held</span>
              )}
            </div>
            <div className="relative z-10 flex flex-wrap gap-x-3 text-xs sm:justify-end">
              <StripeLink href={stripeLinks.payment(h.payment_intent)}>Payment</StripeLink>
              {h.transfer ? <StripeLink href={stripeLinks.transfer(h.transfer)}>Payout</StripeLink> : null}
              {h.via === "mpp" ? <span className="text-muted-foreground">over MPP</span> : null}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

// The standing approval: lets Claude Code hire within one hold without asking.
function Policy() {
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

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 sm:w-80">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="policy-label"
        disabled={busy || cents == null}
        onClick={flip}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:opacity-60 ${
          on ? "bg-(--hire)" : "bg-white/25"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
            on ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="min-w-0 text-sm">
        <p id="policy-label" className="font-medium">
          Hire Without Asking, up to {cap}
        </p>
        <p aria-live="polite" className="truncate text-xs text-white/70">
          {error ?? (cents == null ? "Loading…" : on ? `Stripe caps the payment token at ${cap} too.` : "Claude Code asks before every hire.")}
        </p>
      </div>
    </div>
  );
}

const STAGES = ["Found", "Tryouts", "Winner", "Paid on Proof"];

// A hire in progress: the four stages, then one card per auditioning agent with its tool calls as they land.
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
    <Link href={`/?need=${n.id}`} className="block rounded-3xl bg-block-blue p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <p className="line-clamp-2 max-w-3xl text-lg font-medium">{n.text}</p>
        <span className="shrink-0 animate-pulse rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
          {STATUS[n.status] ?? n.status}…
        </span>
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-2">
        {STAGES.map((label, i) => (
          <li key={label} aria-current={i === current ? "step" : undefined} className="flex flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-colors duration-300 ease-out ${
                done[i] ? "bg-white" : i === current ? "animate-pulse bg-white/60" : "bg-white/20"
              }`}
            />
            <span className={`text-xs ${done[i] || i === current ? "font-medium" : "text-white/60"}`}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid min-h-44 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        {tryouts.map((t) => {
          const lane = steps.filter((s) => s.tryout_id === t.id && s.kind === "tool").slice(-4);
          const passed = t.checks?.filter((c) => c.passed).length ?? 0;
          const name = names.get(t.agent_id) ?? "Specialist";
          return (
            <div key={t.id} className="flex h-44 flex-col gap-2 overflow-hidden rounded-2xl bg-card p-3.5 text-card-foreground">
              <div className="flex items-center gap-2.5">
                <AgentAvatar card={{ id: t.agent_id, name }} size="sm" status={t.status === "running" ? "working" : undefined} />
                <span className="min-w-0 flex-1 truncate font-semibold" translate="no">
                  {name}
                </span>
                {t.status === "scored" && t.score != null ? (
                  <>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {passed}/{t.checks.length}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${scoreTone(t.score)}`}>{t.score.toFixed(1)}</span>
                  </>
                ) : t.status === "failed" ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-sm font-semibold text-destructive">Fail</span>
                ) : (
                  <span className="animate-pulse text-xs text-muted-foreground">Working…</span>
                )}
              </div>
              <ol className="space-y-1 font-mono text-xs leading-snug">
                {lane.map((s) => (
                  <li key={s.id} className="animate-in truncate duration-200 ease-out fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
                    <span className="text-(--hire)">{s.name}</span> {summarize(s.name, s.input)}
                    {outcome(s.name, s.output) ? <span className="text-muted-foreground"> -&gt; {outcome(s.name, s.output)}</span> : null}
                  </li>
                ))}
                {!lane.length ? <li className="font-sans text-muted-foreground">Starting…</li> : null}
              </ol>
            </div>
          );
        })}
      </div>
      <LogoFactory ids={tryouts.map((t) => t.agent_id)} />
    </Link>
  );
}

function StripeLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-(--hire) hover:underline">
      {children}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}
