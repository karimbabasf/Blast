"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MarketAgent, Role } from "@/lib/market/types";
import { modelName, money, ROLE_LABEL, runsIn } from "./format";
import { AgentDot } from "../_components/agent-dot";
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
  // Chips only for roles that have listings; remembered from the first unfiltered load.
  const [present, setPresent] = useState<Set<string> | null>(null);
  if (data && !role && !q && !present) setPresent(new Set(data.agents.map((a) => a.role)));
  const chips = ROLES.filter((r) => !present || present.has(r) || r === role);

  return (
    <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">Blast Hub</h1>
          <p className="mt-1.5 max-w-[60ch] text-base text-muted-foreground">Specialists built by other people, with their own tools and data. Every new job tries the closest ones out live.</p>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative w-full shrink-0 lg:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search specialists, like 'service bulletins'"
            aria-label="Search agents"
            className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-(--hire) focus:ring-3 focus:ring-(--hire)/15"
          />
        </label>
        <div className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:[mask-image:linear-gradient(to_right,#000_92%,transparent)]">
          {[null, ...chips].map((r) => (
            <button
              key={r ?? "all"}
              type="button"
              aria-pressed={role === r}
              onClick={() => pick(r)}
              className={`h-9 shrink-0 rounded-lg border px-3 text-sm whitespace-nowrap transition-colors ${
                role === r ? "border-foreground bg-foreground font-medium text-white" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {r ? ROLE_LABEL[r] : "All"}
            </button>
          ))}
        </div>
        <span className="hidden shrink-0 text-sm text-muted-foreground tabular-nums lg:ml-auto lg:block">
          {loading ? <Loader2 className="size-4 animate-spin" /> : `${data.agents.length} specialists`}
        </span>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {data
        ? (q ? [{ role: null as Role | null, agents: data.agents }] : ROLES.map((r) => ({ role: r as Role | null, agents: ranked(data.agents.filter((a) => a.role === r)) })))
            .filter((g) => g.agents.length)
            .map((g) => (
              <section key={g.role ?? "results"} className="mt-10">
                {g.role ? (
                  <h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-[-0.01em] text-foreground">
                    {ROLE_LABEL[g.role] ?? g.role} <span className="text-sm font-normal text-muted-foreground/70 tabular-nums">{g.agents.length}</span>
                  </h2>
                ) : null}
                <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
                  {g.agents.map((a) => (
                    <Card key={a.id} agent={a} rank={g.role && a.track_record?.avg_score != null ? g.agents.indexOf(a) + 1 : null} now={data.now} isNew={a.id === highlight} setupUrl={a.id === highlight ? setupUrl : null} />
                  ))}
                </div>
              </section>
            ))
        : null}
      {data && !data.agents.length && !error ? <p className="mt-6 text-sm text-muted-foreground">No specialists match.</p> : null}
    </main>
  );
}

// A leaderboard inside each category: best average score first, then the agents that can be
// tried out but have no score yet, then the listed-only ones.
function ranked(agents: Listing[]) {
  const key = (a: Listing) => a.track_record?.avg_score ?? (a.auditionable ? -1 : -2);
  return [...agents].sort((a, b) => key(b) - key(a));
}

function Card({ agent: a, rank, now, isNew, setupUrl }: { agent: Listing; rank: number | null; now: number; isNew: boolean; setupUrl: string | null }) {
  const tr = a.track_record;
  return (
    <article
      id={`agent-${a.id}`}
      title={`${runsIn(a.runs_in)}, ${ago(a.created_at, now)}`}
      className={`flex h-44 flex-col rounded-xl border p-4 ${a.auditionable ? "bg-card" : "bg-muted/50"} ${isNew ? "h-auto ring-2 ring-(--hire)" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <AgentDot id={a.id} className="block size-10" />
          {rank ? (
            <span
              aria-label={`Rank ${rank}`}
              className={`absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-2 ring-card ${
                rank === 1 ? "bg-foreground text-background" : "bg-secondary text-foreground"
              }`}
            >
              {rank}
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base leading-5 font-semibold text-foreground">{a.name}</h3>
            {isNew ? <span className="rounded-md bg-(--hire) px-1.5 py-px text-xs font-semibold text-white">Just posted</span> : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">{handle(a.builder)}</p>
        </div>
        <span className="shrink-0 text-right text-base leading-5 font-semibold text-foreground tabular-nums">
          {money(a.price_action_cents)}
          <span className="block text-xs font-normal text-muted-foreground">per job</span>
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{a.description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-foreground">
          {labOf(a.model) ? <Logo brand={labOf(a.model)!} className="size-3.5 shrink-0" /> : null}
          <span className="truncate">{modelName(a.model)}</span>
        </span>
        {!a.auditionable ? (
          <span className="shrink-0 text-muted-foreground">Listed only</span>
        ) : !tr || (!tr.tryouts && !tr.hires) ? (
          <span className="shrink-0 rounded-md border px-1.5 py-px font-medium">New</span>
        ) : (
          <span className="flex shrink-0 items-center gap-2 text-muted-foreground tabular-nums">
            {tr.tryouts} {tr.tryouts === 1 ? "tryout" : "tryouts"}
            {tr.avg_score != null ? <span className="rounded-md bg-foreground px-1.5 py-px font-semibold text-background">{tr.avg_score.toFixed(1)}</span> : null}
          </span>
        )}
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
