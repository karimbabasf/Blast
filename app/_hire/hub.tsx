"use client";

import { Loader2, Search } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { MarketAgent, Role } from "@/lib/market/types";
import { AgentAvatar } from "../_components/agent-avatar";
import { scoreTone } from "../_components/score-tone";
import { modelName, money, ROLE_LABEL, ROLE_TOOLS, toolLabel } from "./format";
import { labOf, Logo } from "./logos";

export type Listing = Omit<MarketAgent, "system_prompt"> & {
  created_at: string;
  track_record?: { tryouts: number; avg_score: number | null; hires: number };
};

// Specialists first, in ROLE_LABEL order.
const ROLES = Object.keys(ROLE_LABEL) as Role[];

const score = (a: Listing) => a.track_record?.avg_score ?? -1;
const hires = (a: Listing) => a.track_record?.hires ?? 0;

// One leaderboard per role: best average score first, then most hires.
function boards(agents: Listing[]) {
  return ROLES.map((role) => ({
    role,
    agents: agents.filter((a) => a.role === role).sort((a, b) => score(b) - score(a) || hires(b) - hires(a)),
  })).filter((b) => b.agents.length);
}

export function handle(builder: string) {
  return `@${builder.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
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
  // A search keeps the order the vector search returned.
  const groups = !data ? [] : q ? [{ role: null, agents: data.agents }] : boards(data.agents);

  return (
    <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-block-dark p-6 text-white">
        <div>
          <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">Blast Hub</h1>
          <p className="mt-1 text-sm text-white/70">Specialists built by other people, ranked by how they did in real tryouts.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start">
        <label className="relative w-full shrink-0 lg:w-64">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search, like 'service bulletins'…"
            aria-label="Search specialists"
            autoComplete="off"
            className="h-9 w-full rounded-full border bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:border-(--hire) focus-visible:ring-3 focus-visible:ring-(--hire)/15"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[null, ...ROLES].map((r) => (
            <button
              key={r ?? "all"}
              type="button"
              aria-pressed={role === r}
              onClick={() => pick(r)}
              className={`h-8 rounded-full border px-3 text-sm transition-colors duration-150 ease-out active:scale-[0.97] ${
                role === r ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {r ? ROLE_LABEL[r] : "All"}
            </button>
          ))}
        </div>
        <span className="flex h-8 w-32 shrink-0 items-center text-sm whitespace-nowrap text-muted-foreground tabular-nums lg:ml-auto lg:justify-end">
          {loading ? <Loader2 aria-label="Loading" className="size-4 animate-spin" /> : `${data.agents.length} specialists`}
        </span>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-5 overflow-x-auto rounded-2xl ring-1 ring-foreground/10">
        <table className="w-full min-w-[44rem] text-sm tabular-nums">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-14 py-2.5 pl-4 font-normal">#</th>
              <th scope="col" className="py-2.5 font-normal">Specialist</th>
              <th scope="col" className="py-2.5 font-normal">Tools It Brings</th>
              <th scope="col" className="w-20 py-2.5 text-right font-normal">Score</th>
              <th scope="col" className="w-20 py-2.5 text-right font-normal">Tryouts</th>
              <th scope="col" className="w-16 py-2.5 text-right font-normal">Hires</th>
              <th scope="col" className="w-20 py-2.5 pr-4 text-right font-normal">Per job</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.role ?? "search"}>
                {g.role ? (
                  <tr className="bg-muted/60">
                    <th scope="colgroup" colSpan={7} className="px-4 py-1.5 text-left text-xs font-medium">
                      {ROLE_LABEL[g.role]} <span className="font-normal text-muted-foreground">{g.agents.length}</span>
                    </th>
                  </tr>
                ) : null}
                {g.agents.map((a, index) => (
                  <Row
                    key={a.id}
                    agent={a}
                    rank={g.role && a.track_record?.avg_score != null ? index + 1 : null}
                    order={index}
                    isNew={a.id === highlight}
                    setupUrl={a.id === highlight ? setupUrl : null}
                  />
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {data && !data.agents.length && !error ? <p className="mt-6 text-sm text-muted-foreground">No specialists match.</p> : null}
    </main>
  );
}

function Row({
  agent: a,
  rank,
  order,
  isNew,
  setupUrl,
}: {
  agent: Listing;
  rank: number | null;
  order: number;
  isNew: boolean;
  setupUrl: string | null;
}) {
  const tr = a.track_record;
  const average = tr?.avg_score ?? null;
  return (
    <>
      <tr
        id={`agent-${a.id}`}
        title={a.description}
        style={{ animationDelay: `${Math.min(order, 14) * 30}ms` }}
        className={`animate-in border-t duration-300 ease-out fade-in fill-mode-backwards slide-in-from-bottom-1 ${isNew ? "bg-success/8" : ""}`}
      >
        <td className="py-2.5 pl-4">
          {rank ? (
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                rank === 1 ? "bg-success text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {rank}
            </span>
          ) : null}
        </td>
        <td className="py-2.5 pr-4">
          <div className="flex items-center gap-3">
            <AgentAvatar card={a} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold" translate="no">
                  {a.name}
                </span>
                {isNew ? <span className="rounded-full bg-success px-2 py-px text-xs font-medium text-white">Just posted</span> : null}
                {!a.auditionable ? <span className="rounded-full bg-muted px-2 py-px text-xs text-muted-foreground">Listed only</span> : null}
              </div>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {handle(a.builder)} ·{labOf(a.model) ? <Logo brand={labOf(a.model)!} className="size-3 shrink-0" /> : null}
                {modelName(a.model)}
              </p>
            </div>
          </div>
        </td>
        <td className="py-2.5 pr-4">
          <ul className="flex flex-wrap gap-1">
            {(ROLE_TOOLS[a.role] ?? a.tools).map((t) => {
              const has = a.tools.includes(t);
              return (
                <li
                  key={t}
                  title={has ? t : `${t}: not available to this agent`}
                  className={`h-5 rounded-full px-2 text-xs leading-5 ${has ? "bg-muted" : "text-muted-foreground/60 line-through"}`}
                >
                  {toolLabel(t)}
                </li>
              );
            })}
          </ul>
        </td>
        <td className="py-2.5 text-right">
          {average != null ? (
            <span className={`inline-block rounded-full px-2.5 py-0.5 font-semibold ${scoreTone(average)}`}>{average.toFixed(1)}</span>
          ) : (
            <span className="text-muted-foreground">New</span>
          )}
        </td>
        <td className="py-2.5 text-right">{tr?.tryouts ?? 0}</td>
        <td className={`py-2.5 text-right ${tr?.hires ? "font-semibold text-success" : "text-muted-foreground"}`}>{tr?.hires ?? 0}</td>
        <td className="py-2.5 pr-4 text-right font-medium">{money(a.price_action_cents)}</td>
      </tr>
      {isNew ? (
        <tr className="bg-success/8">
          <td />
          <td colSpan={6} className="pr-4 pb-2.5 text-xs">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-2 rounded-full ${a.stripe_account ? "bg-success" : "bg-warning"}`} />
              {a.stripe_account ? "Payouts through Stripe Connect" : "Payout account not set up yet"}
              {setupUrl ? (
                <a href={setupUrl} className="font-medium underline underline-offset-4">
                  Finish Payout Setup
                </a>
              ) : null}
            </span>
          </td>
        </tr>
      ) : null}
    </>
  );
}
