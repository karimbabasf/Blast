"use client";

import { Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MarketAgent, Role } from "@/lib/market/types";
import { modelName, money, ROLE_LABEL, runsIn } from "./format";
import { labOf, Logo } from "./logos";

export type Listing = Omit<MarketAgent, "system_prompt"> & {
  created_at: string;
  track_record?: { tryouts: number; avg_score: number | null; hires: number };
};

// Specialists first, in ROLE_LABEL order.
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
          <p className="mt-1 text-sm text-muted-foreground">Specialists built by other people, with their own tools and data. Each new job runs a tryout across them.</p>
        </div>
        <Link
          href="/post"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--hire) px-4 text-sm font-medium text-white transition-colors hover:bg-(--hire)/90"
        >
          <Plus className="size-4" /> Post your specialist
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search specialists, like 'service bulletins'"
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
          {loading ? <Loader2 className="size-4 animate-spin" /> : `${data.agents.length} specialists`}
        </span>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {data
        ? (q ? [{ role: null as Role | null, agents: data.agents }] : ROLES.map((r) => ({ role: r as Role | null, agents: data.agents.filter((a) => a.role === r) })))
            .filter((g) => g.agents.length)
            .map((g) => (
              <section key={g.role ?? "results"} className="mt-8">
                {g.role ? (
                  <h2 className="text-lg font-semibold tracking-tight text-stone-900">
                    {ROLE_LABEL[g.role] ?? g.role} <span className="font-normal text-stone-500 tabular-nums">{g.agents.length}</span>
                  </h2>
                ) : null}
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-3">
                  {g.agents.map((a) => (
                    <Card key={a.id} agent={a} now={data.now} isNew={a.id === highlight} setupUrl={a.id === highlight ? setupUrl : null} />
                  ))}
                </div>
              </section>
            ))
        : null}
      {data && !data.agents.length && !error ? <p className="mt-6 text-sm text-muted-foreground">No specialists match.</p> : null}
    </main>
  );
}

function Card({ agent: a, now, isNew, setupUrl }: { agent: Listing; now: number; isNew: boolean; setupUrl: string | null }) {
  const tr = a.track_record;
  return (
    <article
      id={`agent-${a.id}`}
      className={`flex flex-col rounded-2xl bg-white p-4 text-sm shadow-[0_1px_2px_rgb(70_50_30/0.06),0_12px_32px_-16px_rgb(70_50_30/0.18)] ${isNew ? "ring-2 ring-(--hire)" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{a.name}</h2>
            {isNew ? <span className="rounded-full bg-(--hire) px-2 py-px text-xs font-medium text-white">Just posted</span> : null}
          </div>
          <p className="truncate text-muted-foreground">{handle(a.builder)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{ROLE_LABEL[a.role] ?? a.role}</span>
      </div>
      {a.description ? <p className="mt-2 line-clamp-2 text-muted-foreground">{a.description}</p> : null}
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Model</dt>
        <dd className="flex min-w-0 items-center gap-1.5">
          {labOf(a.model) ? <Logo brand={labOf(a.model)!} className="size-3.5 shrink-0" /> : null}
          <span className="truncate">{modelName(a.model)}</span>
        </dd>
        <dt className="text-muted-foreground">Runs</dt>
        <dd className="truncate">{runsIn(a.runs_in).replace(/^Runs /, "")}</dd>
        <dt className="text-muted-foreground">Price</dt>
        <dd className="tabular-nums">
          <span className="font-medium">{money(a.price_action_cents)}</span> per job
        </dd>
        <dt className="text-muted-foreground">Record</dt>
        <dd className="tabular-nums">
          {!tr || (!tr.tryouts && !tr.hires) ? (
            <span className="text-(--hire)">New</span>
          ) : (
            <>
              {tr.tryouts} {tr.tryouts === 1 ? "tryout" : "tryouts"} · {tr.avg_score != null ? `avg ${tr.avg_score.toFixed(1)}` : "no score"} · {tr.hires} hired
            </>
          )}
        </dd>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
        <span>{ago(a.created_at, now)}</span>
        {!a.auditionable ? <span>Listed only</span> : null}
      </div>
      {isNew ? (
        <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs">
          <span className={`size-2 rounded-full ${a.stripe_account ? "bg-success" : "bg-warning"}`} />
          {a.stripe_account ? "Payouts through Stripe Connect" : "Payout account not set up yet"}
          {setupUrl ? (
            <a href={setupUrl} className="ml-auto font-medium text-(--hire) hover:underline">
              Finish payout setup
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
