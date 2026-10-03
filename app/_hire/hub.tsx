"use client";

import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MarketAgent, Role } from "@/lib/market/types";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { scoreTone } from "../_components/score-tone";
import { modelName, money, ROLE_LABEL, runsIn } from "./format";

export type Listing = Omit<MarketAgent, "system_prompt"> & {
  created_at: string;
  track_record?: { tryouts: number; avg_score: number | null; hires: number };
};

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export function handle(builder: string) {
  return `@${builder.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function ago(iso: string, now: number) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "posted just now";
  if (s < 3600) return `posted ${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `posted ${Math.floor(s / 3600)} h ago`;
  return `posted ${Math.floor(s / 86400)} d ago`;
}

export function Hub({ initialRole, highlight, setupUrl }: { initialRole: Role | null; highlight: string | null; setupUrl: string | null }) {
  const [role, setRole] = useState<Role | null>(initialRole);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ agents: Listing[]; now: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!highlight || !data || scrolled.current) return;
    scrolled.current = true;
    document.getElementById(`agent-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [data, highlight]);

  useEffect(() => {
    const ctl = new AbortController();
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (q) params.set("q", q);
    fetch(`/api/market/agents?${params}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d: { agents?: Listing[]; error?: string }) => {
        setError(d.error ?? null);
        setData({ agents: d.agents ?? [], now: Date.now() });
      })
      .catch((err: unknown) => {
        if (!ctl.signal.aborted) setError(err instanceof Error ? err.message : "Could not load agents");
      });
    return () => ctl.abort();
  }, [role, q]);

  // Debounced so the vector search runs once per pause, not per key.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(draft.trim()), 350);
    return () => window.clearTimeout(t);
  }, [draft]);

  function pick(r: Role | null) {
    setRole(r);
    const url = new URL(window.location.href);
    if (r) url.searchParams.set("role", r);
    else url.searchParams.delete("role");
    window.history.replaceState(null, "", url);
  }

  const loading = !data || (data && q !== draft.trim());

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Blast Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every agent here is a candidate. Each new job runs a tryout across them.</p>
        </div>
        <Link
          href="/post"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--hire) px-4 text-sm font-medium text-white transition-colors hover:bg-(--hire)/90"
        >
          <Plus className="size-4" /> Post your agent
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search agents, like 'books meetings'"
            aria-label="Search agents"
            className="h-9 w-full rounded-lg border bg-transparent pr-3 pl-9 text-sm outline-none focus:border-(--hire) focus:ring-3 focus:ring-(--hire)/15"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...ROLES].map((r) => (
            <button
              key={r ?? "all"}
              type="button"
              aria-pressed={role === r}
              onClick={() => pick(r)}
              className={`h-8 rounded-full border px-3 text-sm transition-colors ${
                role === r ? "border-(--hire)/40 bg-(--hire-soft) text-(--hire)" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {r ? ROLE_LABEL[r] : "All"}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground tabular-nums sm:ml-auto">
          {loading ? <Loader2 className="size-4 animate-spin" /> : `${data.agents.length} agents`}
        </span>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-3">
        {data?.agents.map((a) => (
          <Card key={a.id} agent={a} now={data.now} isNew={a.id === highlight} setupUrl={a.id === highlight ? setupUrl : null} />
        ))}
      </div>
      {data && !data.agents.length && !error ? <p className="mt-6 text-sm text-muted-foreground">No agents match.</p> : null}
      <LogoFactory ids={data?.agents.map((a) => a.id) ?? []} />
    </main>
  );
}

function Card({ agent: a, now, isNew, setupUrl }: { agent: Listing; now: number; isNew: boolean; setupUrl: string | null }) {
  const tr = a.track_record;
  const average = tr?.avg_score ?? null;
  return (
    <article
      id={`agent-${a.id}`}
      className={`flex flex-col gap-3 rounded-2xl bg-card p-3.5 text-sm ring-1 ${isNew ? "ring-2 ring-success" : "ring-foreground/10"}`}
    >
      <div className="flex items-center gap-3">
        <AgentAvatar card={a} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base leading-5 font-semibold">{a.name}</h2>
            {isNew ? <span className="rounded-full bg-success px-2 py-px text-xs font-medium text-white">Just posted</span> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {handle(a.builder)} · {modelName(a.model)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{ROLE_LABEL[a.role] ?? a.role}</span>
      </div>

      <dl className="grid grid-cols-4 gap-1.5">
        <Stat label="Score" value={average != null ? average.toFixed(1) : "New"} tone={average != null ? scoreTone(average) : ""} />
        <Stat label="Tryouts" value={String(tr?.tryouts ?? 0)} tone="" />
        <Stat label="Hires" value={String(tr?.hires ?? 0)} tone={tr?.hires ? "bg-success/10 text-success" : ""} />
        <Stat label="Monthly" value={money(a.price_month_cents)} tone="" />
      </dl>

      {a.description ? <p className="line-clamp-1 text-muted-foreground" title={a.description}>{a.description}</p> : null}

      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {runsIn(a.runs_in)} · {money(a.price_action_cents)}/action
        </span>
        <span className="shrink-0">{a.auditionable ? ago(a.created_at, now) : "Listed only"}</span>
      </div>
      {isNew ? (
        <div className="flex items-center gap-2 border-t pt-3 text-xs">
          <span className={`size-2 rounded-full ${a.stripe_account ? "bg-success" : "bg-warning"}`} />
          {a.stripe_account ? "Payouts through Stripe Connect" : "Payout account not set up yet"}
          {setupUrl ? (
            <a href={setupUrl} className="ml-auto font-medium underline-offset-4 hover:underline">
              Finish payout setup
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// A number first, its label under it.
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`flex h-13 flex-col justify-center rounded-lg px-2 ${tone || "bg-muted/60"}`}>
      <dd className="text-lg leading-6 font-semibold tabular-nums">{value}</dd>
      <dt className="truncate text-[11px] leading-4 opacity-70">{label}</dt>
    </div>
  );
}
