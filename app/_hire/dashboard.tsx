"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketAgent, TryoutStep } from "@/lib/market/types";
import { AgentAvatar } from "../_components/agent-avatar";
import { scoreTone } from "../_components/score-tone";
import { db } from "./db";
import { clock, modelName, money, ROLE_LABEL, ROLE_TOOLS, summarize, tokenCost } from "./format";
import { Policy } from "./hires";
import { type Brand, Logo } from "./logos";
import { capturedCents, ClaimCodes, type Claim, type Estimate, EstimateTable, type Hold, isEstimate, type LiveNeed, type LiveTryout, stripeLinks } from "./proof";
import { Scorecard } from "./scorecard";
import { TabTrack } from "./tab-track";
import { useNeed } from "./use-need";
import { SpeakButton } from "./voice";

type Site = { title: string; palette: string[]; fonts: { display: string; body: string }; html: string; live_url: string };

const MCP = "claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp";

const FEED_IN = "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none";
const ACTIVE = new Set(["auditioning", "checkout"]);

const TABS = ["overview", "tryouts", "payment", "search"] as const;
type TabId = (typeof TABS)[number];
const TAB_LABEL: Record<TabId, string> = { overview: "Overview", tryouts: "Tryouts", payment: "Payment", search: "Search" };

function isTab(v: string | null): v is TabId {
  return TABS.includes(v as TabId);
}

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

// One small pill for how a hire stands. The only filled colour on the page besides the agent dots.
function Status({ need }: { need: LiveNeed }) {
  const working = ACTIVE.has(need.status);
  const released = need.status === "waiting" || need.hold?.status === "released";
  const tone = working ? "bg-primary/10 text-primary" : released ? "bg-muted text-muted-foreground" : "bg-success/10 text-success";
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-medium ${tone} ${working ? "animate-pulse motion-reduce:animate-none" : ""}`}>
      {working ? "Working…" : released ? "Nobody passed" : "Completed"}
    </span>
  );
}

// The list of hires on the left, the picked hire on the right.
export function Dashboard({ initialNeed, initialTab }: { initialNeed: string | null; initialTab: string | null }) {
  const needs = useHires();
  const [picked, setPicked] = useState<string | null>(initialNeed);
  // Null until the user picks a tab; until then the hire's state chooses one.
  const [tab, setTab] = useState<TabId | null>(isTab(initialTab) ? initialTab : null);
  const newest = needs?.[0]?.id ?? null;
  const [seen, setSeen] = useState<string | null>(null);

  // A new hire always takes focus, even after a click on an older one.
  if (newest && newest !== seen) {
    setSeen(newest);
    if (seen) {
      setPicked(null);
      setTab(null);
    }
  }

  // The picked tab lives in the URL, so a reload keeps it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab) url.searchParams.set("tab", tab);
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }, [tab]);

  const focus = picked ?? newest;

  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-6 px-4 pt-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Hires</h1>
        <Policy />
      </div>

      {!needs ? null : !focus ? (
        <Empty />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Hires needs={needs} focus={focus} onPick={setPicked} />
          <Focus key={focus} id={focus} fallback={needs.find((n) => n.id === focus) ?? null} tab={tab} onTab={setTab} />
        </div>
      )}
    </main>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border px-6 py-16 text-center">
      <p className="mx-auto flex w-fit items-center gap-2.5 text-base font-medium">
        <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        Waiting for an agent to hire…
      </p>
      <p className="mt-4 text-sm text-muted-foreground">Connect Claude Code to Blast:</p>
      <code className="mt-2 inline-block max-w-full overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-sm select-all">{MCP}</code>
    </div>
  );
}

// Every hire as a row. Picking one swaps the view beside it in place; nothing navigates.
function Hires({ needs, focus, onPick }: { needs: LiveNeed[]; focus: string; onPick: (id: string) => void }) {
  return (
    <ul aria-label="Hires" className="flex gap-2 overflow-x-auto lg:max-h-[calc(100dvh-10rem)] lg:flex-col lg:gap-0 lg:overflow-x-visible lg:overflow-y-auto">
      {needs.map((n) => {
        const on = n.id === focus;
        return (
          <li key={n.id} className="shrink-0 lg:border-b">
            <button
              type="button"
              onClick={() => onPick(n.id)}
              aria-pressed={on}
              className={`flex h-16 w-64 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors duration-150 ease-out lg:w-full ${on ? "bg-muted" : "hover:bg-muted/60"}`}
            >
              {n.result?.agent_id ? (
                <AgentAvatar card={{ id: n.result.agent_id, name: n.result.agent_name }} size="sm" />
              ) : (
                <span aria-hidden="true" className={`size-8 shrink-0 rounded-full bg-secondary ${ACTIVE.has(n.status) ? "animate-pulse motion-reduce:animate-none" : ""}`} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{n.text}</span>
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {n.result?.agent_name ?? (ACTIVE.has(n.status) ? "Working…" : "Nobody passed")}
                  {n.hold?.status === "captured" ? ` · ${money(capturedCents(n.hold))}` : ""} · {clock(n.created_at)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const STEPS = ["Search", "Tryouts", "Paid on proof", "Delivered"];

function Focus({ id, fallback, tab, onTab }: { id: string; fallback: LiveNeed | null; tab: TabId | null; onTab: (t: TabId) => void }) {
  const view = useNeed(id);
  const need = (view.need as LiveNeed | null) ?? fallback;
  if (!need) return null;
  const loaded = !!view.need;
  const tryouts = view.tryouts as LiveTryout[];
  const winnerId = need.result?.agent_id ?? need.hold?.agent_id ?? null;
  const running = tryouts.some((t) => t.status === "running");
  const byAgent = new Map(tryouts.map((t) => [t.agent_id, t]));
  const field = view.agents.filter((a) => byAgent.has(a.id));
  const ranked = [...field].sort((x, y) => (byAgent.get(y.id)?.score ?? -1) - (byAgent.get(x.id)?.score ?? -1));
  const best = running ? null : (ranked[0]?.id ?? null);
  const winner = winnerId ? (byAgent.get(winnerId) ?? null) : null;

  const searched = !!need.search || tryouts.length > 0;
  const auditioned = tryouts.length > 0 && !running;
  const paid = need.hold?.status === "captured" || need.hold?.status === "released";
  const delivered = !!need.result;
  const done = [searched, auditioned, paid, delivered];
  const live = done.indexOf(false);
  const working = ACTIVE.has(need.status);
  const hold = need.hold ?? null;

  // A running hire opens on the live tryouts, a finished one on its result.
  const current = tab ?? (working ? "tryouts" : "overview");
  const checks = winner?.checks ?? [];
  const facts = [
    need.result ? `${need.result.agent_name} won` : working ? (tryouts.length ? `Trying out ${tryouts.length}` : "Searching the Hub") : "Nobody passed",
    winner?.score != null ? `${winner.score.toFixed(1)} score` : null,
    checks.length ? `${checks.filter((c) => c.passed).length}/${checks.length} checks` : null,
    hold ? (hold.status === "captured" ? `${money(capturedCents(hold))} captured` : hold.status === "released" ? `${money(hold.amount_cents)} released` : `${money(hold.amount_cents)} held`) : null,
  ].filter((f): f is string => !!f);

  return (
    <article className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="truncate">
            {ROLE_LABEL[need.role] ?? need.role} · {clock(need.created_at)} · Hired by Claude Code
          </span>
          <span className="ml-auto">
            <Status need={need} />
          </span>
        </div>
        <h2 title={need.text} className="line-clamp-2 h-14 max-w-4xl text-xl leading-7 font-semibold tracking-tight text-pretty">
          {need.text}
        </h2>
        <p className="flex h-8 items-center gap-2 text-sm text-muted-foreground tabular-nums">
          {need.result ? <AgentAvatar card={{ id: need.result.agent_id, name: need.result.agent_name }} size="xs" /> : null}
          {facts.map((f, i) => (
            <span key={f} className={i === 0 ? "font-medium text-foreground" : ""}>
              {i ? "· " : ""}
              {f}
            </span>
          ))}
        </p>
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === live ? "step" : undefined} className="flex flex-col gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1 rounded-full transition-colors duration-300 ease-out ${done[i] ? "bg-foreground" : i === live ? "animate-pulse bg-primary motion-reduce:animate-none" : "bg-secondary"}`}
              />
              <span className={`truncate text-xs ${done[i] || i === live ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </li>
          ))}
        </ol>
      </header>

      <Tabs current={current} onPick={onTab} />

      <div className="min-h-[28rem]">
        <Panel id="overview" current={current}>
          {need.result ? (
            <div className={FEED_IN}>
              <Delivered result={need.result} />
            </div>
          ) : (
            <Nothing>{working ? "The winner's work lands here…" : "Nobody passed the proof, so nothing was delivered."}</Nothing>
          )}
        </Panel>

        <Panel id="tryouts" current={current}>
          {field.length ? (
            <Tryouts agents={running ? field : ranked} byAgent={byAgent} steps={view.steps} winnerId={running ? null : (winnerId ?? best)} running={running} />
          ) : (
            <Nothing>{!loaded ? "Loading the tryouts…" : working ? "Searching the Hub for specialists…" : "No specialist was tried out for this hire."}</Nothing>
          )}
          <Scorecard agents={field} ranks={running ? null : ranked.map((a) => a.id)} byAgent={byAgent} winnerId={running ? null : (winnerId ?? best)} tools={ROLE_TOOLS[need.role] ?? []} />
        </Panel>

        <Panel id="payment" current={current}>
          <Caption logo="stripe">Held before the work, captured only when the winner passed.</Caption>
          {hold ? (
            <Money hold={hold} builder={winnerId ? field.find((a) => a.id === winnerId)?.builder : undefined} />
          ) : (
            <Nothing>{working ? "The hold is placed once a specialist is picked…" : "No payment was held for this hire."}</Nothing>
          )}
        </Panel>

        <Panel id="search" current={current}>
          <Caption logo="supabase">Semantic search (pgvector) over {need.search?.listings ?? "the"} Hub listings.</Caption>
          {need.search?.matches.length ? (
            <SearchMatches need={need} tried={new Set(tryouts.map((t) => t.agent_id))} />
          ) : (
            <Nothing>{working && !searched ? "Searching the Hub…" : "No search record was kept for this hire."}</Nothing>
          )}
        </Panel>
      </div>
    </article>
  );
}

function Tabs({ current, onPick }: { current: TabId; onPick: (t: TabId) => void }) {
  // Left and right move between tabs, Home and End jump to the ends.
  function onKeyDown(e: React.KeyboardEvent) {
    const at = TABS.indexOf(current);
    const to =
      e.key === "ArrowRight" ? (at + 1) % TABS.length : e.key === "ArrowLeft" ? (at + TABS.length - 1) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onPick(TABS[to]);
    document.getElementById(`hire-tab-${TABS[to]}`)?.focus();
  }

  const items = TABS.map((t) => ({ id: t, label: TAB_LABEL[t] }));

  return (
    <div className="overflow-x-auto">
      <TabTrack items={items} active={current} role="tablist" aria-label="Hire details" onKeyDown={onKeyDown}>
        {(item, className) => (
          <button
            type="button"
            role="tab"
            id={`hire-tab-${item.id}`}
            aria-selected={item.id === current}
            aria-controls={`hire-panel-${item.id}`}
            tabIndex={item.id === current ? 0 : -1}
            onClick={() => onPick(item.id as TabId)}
            className={className}
          >
            {item.label}
          </button>
        )}
      </TabTrack>
    </div>
  );
}

// Every panel stays mounted, so a tab keeps its state; only the picked one shows.
function Panel({ id, current, children }: { id: TabId; current: TabId; children: React.ReactNode }) {
  return (
    <div
      role="tabpanel"
      id={`hire-panel-${id}`}
      aria-labelledby={`hire-tab-${id}`}
      hidden={id !== current}
      tabIndex={0}
      className="flex animate-in flex-col gap-4 rounded-lg duration-200 ease-out fade-in motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}

function Caption({ logo, children }: { logo: Brand; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Logo brand={logo} className="size-4 shrink-0" />
      {children}
    </p>
  );
}

function Nothing({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

const TH = "py-2 pr-4 text-left text-xs font-normal text-muted-foreground";

// One row per candidate: who it is, how it scored, and where it stands right now.
function Tryouts({
  agents,
  byAgent,
  steps,
  winnerId,
  running,
}: {
  agents: MarketAgent[];
  byAgent: Map<string, LiveTryout>;
  steps: TryoutStep[];
  winnerId: string | null;
  running: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[40rem] text-sm tabular-nums">
        <thead>
          <tr>
            <th scope="col" className={`${TH} w-72 pl-4`}>
              Specialist
            </th>
            <th scope="col" className={`${TH} w-20`}>
              Score
            </th>
            <th scope="col" className={`${TH} w-20`}>
              Checks
            </th>
            <th scope="col" className={`${TH} w-24`}>
              Tokens
            </th>
            <th scope="col" className={`${TH} w-20`}>
              Per job
            </th>
            <th scope="col" className={TH}>
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => {
            const t = byAgent.get(a.id);
            const checks = t?.checks ?? [];
            const failed = checks.find((c) => !c.passed);
            const last = steps.filter((s) => s.tryout_id === t?.id && s.kind === "tool").at(-1);
            return (
              <tr key={a.id} className={`h-14 border-t ${a.id === winnerId ? "bg-success/5" : ""}`}>
                <td className="py-2 pr-4 pl-4">
                  <div className="flex items-center gap-3">
                    <AgentAvatar card={a} size="sm" status={t?.status === "running" ? "working" : undefined} />
                    <div className="min-w-0">
                      <div className="truncate font-medium" translate="no">
                        {a.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {modelName(a.model)} · {a.builder}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="pr-4">
                  {t?.score != null ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${scoreTone(t.score)}`}>{t.score.toFixed(1)}</span>
                  ) : (
                    <span className="text-muted-foreground">{t?.status === "failed" ? "Failed" : "…"}</span>
                  )}
                </td>
                <td className="pr-4">{checks.length ? `${checks.filter((c) => c.passed).length}/${checks.length}` : <span className="text-muted-foreground">…</span>}</td>
                <td className="pr-4 text-muted-foreground">{t?.usage?.cost_usd != null ? tokenCost(t.usage.cost_usd) : "…"}</td>
                <td className="pr-4">{money(a.price_action_cents)}</td>
                <td className="max-w-0 pr-4">
                  <span className="flex items-center gap-1.5 truncate">
                    {a.id === winnerId ? (
                      <span className="font-medium text-success">Hired</span>
                    ) : failed ? (
                      <>
                        <X aria-hidden="true" className="size-3.5 shrink-0 text-destructive" strokeWidth={3} />
                        <span className="truncate text-muted-foreground" title={failed.name}>
                          {failed.name}
                        </span>
                      </>
                    ) : checks.length ? (
                      <>
                        <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" strokeWidth={3} />
                        <span className="truncate text-muted-foreground">All checks passed</span>
                      </>
                    ) : last ? (
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {last.name} {summarize(last.name, last.input)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{running ? "Starting…" : ""}</span>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SearchMatches({ need, tried }: { need: LiveNeed; tried: Set<string> }) {
  const matches = need.search?.matches ?? [];
  return (
    <ul className="rounded-xl border">
      {matches.slice(0, 8).map((m, i) => (
        <li key={m.id} className={`flex h-12 items-center gap-3 px-4 text-sm ${i ? "border-t" : ""}`}>
          <AgentAvatar card={m} size="xs" />
          <span className="w-40 truncate font-medium" translate="no">
            {m.name}
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-muted-foreground sm:block">{m.builder}</span>
          {tried.has(m.id) ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Tried out</span> : null}
          <span className="ml-auto w-12 text-right font-medium tabular-nums">{Math.round(m.similarity * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

// The money as a short ledger: what was paid, held, captured and paid out.
function Money({ hold: h, builder }: { hold: Hold; builder?: string }) {
  const captured = h.status === "captured";
  const released = h.status === "released";
  const rows: { label: string; value: React.ReactNode; note: React.ReactNode; on: boolean }[] = [
    { label: "Paid by", value: h.via === "mpp" ? "MPP 402" : "Card", note: h.via === "mpp" ? "Claude Code paid the HTTP 402" : "Card on file", on: true },
    {
      label: "Held",
      value: money(h.amount_cents),
      note: h.spt ? <span className="font-mono text-xs">{h.spt}</span> : <Ref href={stripeLinks.payment(h.payment_intent)} id={h.payment_intent} />,
      on: true,
    },
    released
      ? { label: "Released", value: money(h.amount_cents), note: "No specialist passed, nothing charged", on: true }
      : {
          label: "Captured",
          value: captured ? money(capturedCents(h)) : "…",
          note: captured ? <Ref href={stripeLinks.payment(h.payment_intent)} id={h.payment_intent} /> : "Waits for the proof",
          on: captured,
        },
    ...(released
      ? []
      : [
          {
            label: `Paid out to ${builder ?? "the builder"}`,
            value: h.builder_cents != null && h.transfer ? money(h.builder_cents) : "…",
            note: h.transfer ? <Ref href={stripeLinks.transfer(h.transfer)} id={h.transfer} /> : "Through Stripe Connect",
            on: !!h.transfer,
          },
          ...(captured && h.blast_cents != null ? [{ label: "Blast kept", value: money(h.blast_cents), note: "", on: true }] : []),
        ]),
  ];
  return (
    <dl className="rounded-xl border text-sm">
      {rows.map((r, i) => (
        <div key={r.label} className={`flex h-12 items-center gap-4 px-4 ${i ? "border-t" : ""} ${r.on ? "" : "text-muted-foreground"}`}>
          <dt className="w-48 shrink-0 truncate">{r.label}</dt>
          <dd className="w-20 shrink-0 font-semibold tabular-nums">{r.value}</dd>
          <dd className="min-w-0 flex-1 truncate text-right text-muted-foreground">{r.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function Ref({ href, id }: { href: string; id: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
      {id}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}

// Replies arrive as light markdown: keep **bold**, drop the markers.
function bold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold">{part}</strong> : part));
}

function isSite(o: unknown): o is Site {
  return !!o && typeof o === "object" && typeof (o as Site).html === "string";
}

function Delivered({ result }: { result: NonNullable<LiveNeed["result"]> }) {
  const out = result.output as Estimate | Claim | Site | null;
  return (
    <div>
      {result.reply ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="max-w-3xl text-base leading-relaxed text-pretty whitespace-pre-line">{bold(result.reply)}</p>
          <SpeakButton text={result.reply} />
        </div>
      ) : null}
      {isSite(out) ? <SitePreview site={out} /> : out ? isEstimate(out as Estimate | Claim) ? <EstimateTable e={out as Estimate} /> : "icd10" in out ? <ClaimCodes c={out as Claim} /> : null : null}
    </div>
  );
}

function SitePreview({ site }: { site: Site }) {
  return (
    <div className="mt-4">
      <div className="relative h-[420px] overflow-hidden rounded-xl border bg-white">
        <iframe title={site.title} srcDoc={site.html} sandbox="" className="absolute top-0 left-0 h-[840px] w-[200%] origin-top-left scale-50 border-0" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-medium">{site.title}</span>
        <span aria-label={`Palette: ${site.palette.join(", ")}`} role="img" className="flex gap-1">
          {site.palette.map((c) => (
            <span key={c} className="size-4 rounded-full ring-1 ring-foreground/10" style={{ background: c }} />
          ))}
        </span>
        <span className="text-muted-foreground">
          {site.fonts.display} / {site.fonts.body}
        </span>
        {site.live_url ? (
          <a
            href={site.live_url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-medium transition-colors duration-150 ease-out hover:bg-muted"
          >
            Open live site <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
