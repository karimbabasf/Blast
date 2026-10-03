"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import { TabTrack } from "./tab-track";
import { useEffect, useState } from "react";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { Candidate } from "./candidate";
import { db } from "./db";
import { clock, money, ROLE_LABEL, ROLE_TOOLS } from "./format";
import { Policy } from "./hires";
import { type Brand, Logo } from "./logos";
import { capturedCents, ClaimCodes, type Claim, type Estimate, EstimateTable, type Hold, isEstimate, type LiveNeed, type LiveTryout, stripeLinks } from "./proof";
import { Scorecard } from "./scorecard";
import { useNeed } from "./use-need";
import { SpeakButton } from "./voice";

type Site = { title: string; palette: string[]; fonts: { display: string; body: string }; html: string; live_url: string };

const MCP = "claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp";

const CARD = "rounded-3xl bg-card ring-1 ring-foreground/10";
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

// The hire tiles and the spend switch, one blue summary, then tabs for the detail.
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
    <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-4 px-4 pt-6 pb-16">
      <h1 className="sr-only">Agents That Hire Agents</h1>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">{needs && focus ? <History needs={needs} focus={focus} onPick={setPicked} /> : <div className="h-[4.5rem]" />}</div>
        <Policy />
      </div>

      {!needs ? null : !focus ? (
        <Empty />
      ) : (
        <Focus key={focus} id={focus} fallback={needs.find((n) => n.id === focus) ?? null} tab={tab} onTab={setTab} />
      )}
    </main>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl bg-block-blue px-6 py-16 text-center text-white">
      <p className="mx-auto flex w-fit items-center gap-2.5 text-xl">
        <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
        Waiting for an Agent to Hire…
      </p>
      <p className="mt-6 text-sm text-white/70">Connect Claude Code to Blast:</p>
      <code className="mt-2 inline-block max-w-full overflow-x-auto rounded-xl bg-white/15 px-4 py-2.5 font-mono text-sm select-all">{MCP}</code>
    </div>
  );
}

const STEPS = ["Search", "Tryouts", "Paid on Proof", "Delivered"];

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

  const searched = !!need.search || tryouts.length > 0;
  const auditioned = tryouts.length > 0 && !running;
  const paid = need.hold?.status === "captured" || need.hold?.status === "released";
  const delivered = !!need.result;
  const done = [searched, auditioned, paid, delivered];
  const live = done.indexOf(false);
  const working = ACTIVE.has(need.status);

  // A running hire opens on the live tryouts, a finished one on its result.
  const current = tab ?? (working ? "tryouts" : "overview");
  const hold = need.hold ?? null;

  return (
    <article className="flex flex-col gap-4">
      <Summary need={need} working={working} delivered={delivered} done={done} live={live} loaded={loaded} tried={tryouts.length} winner={winnerId ? (byAgent.get(winnerId) ?? null) : null} />
      <Tabs current={current} onPick={onTab} />

      <div className="min-h-[30rem]">
        <Panel id="overview" current={current}>
          <section className={`${CARD} p-5`}>
            {need.result ? (
              <div className={FEED_IN}>
                <Delivered result={need.result} />
              </div>
            ) : (
              <Nothing>{working ? "The winner's work lands here…" : "Nobody passed the proof, so nothing was delivered."}</Nothing>
            )}
          </section>
        </Panel>

        <Panel id="tryouts" current={current}>
          <ul className="grid min-h-[17rem] grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3">
            {(running ? field : ranked).map((a, index) => (
              <li key={a.id} className={FEED_IN}>
                <Candidate
                  agent={a}
                  rank={running || byAgent.get(a.id)?.score == null ? null : index + 1}
                  tryout={byAgent.get(a.id) ?? null}
                  steps={view.steps.filter((s) => s.tryout_id === byAgent.get(a.id)?.id)}
                  winner={!running && a.id === (winnerId ?? best)}
                  leading={false}
                />
              </li>
            ))}
            {!field.length ? (
              <li className="flex items-center justify-center text-sm text-muted-foreground">
                {!loaded ? "Loading the tryouts…" : working ? "Searching the Hub for specialists…" : "No specialist was tried out for this hire."}
              </li>
            ) : null}
          </ul>
          <Scorecard agents={field} ranks={running ? null : ranked.map((a) => a.id)} byAgent={byAgent} winnerId={running ? null : (winnerId ?? best)} tools={ROLE_TOOLS[need.role] ?? []} />
        </Panel>

        <Panel id="payment" current={current}>
          <section className={`${CARD} p-5`}>
            <Caption logo="stripe">Held before the work, captured only when the winner passed.</Caption>
            {hold ? (
              <div className="mt-4">
                <Money hold={hold} builder={winnerId ? field.find((a) => a.id === winnerId)?.builder : undefined} />
              </div>
            ) : (
              <Nothing>{working ? "The hold is placed once a specialist is picked…" : "No payment was held for this hire."}</Nothing>
            )}
          </section>
        </Panel>

        <Panel id="search" current={current}>
          <section className={`${CARD} p-5`}>
            <Caption logo="supabase">Semantic search (pgvector) over {need.search?.listings ?? "the"} Hub listings.</Caption>
            {need.search?.matches.length ? (
              <div className="mt-4">
                <SearchMatches need={need} tried={new Set(tryouts.map((t) => t.agent_id))} />
              </div>
            ) : (
              <Nothing>{working && !searched ? "Searching the Hub…" : "No search record was kept for this hire."}</Nothing>
            )}
          </section>
        </Panel>
      </div>
      <LogoFactory ids={[...field.map((a) => a.id), ...(need.search?.matches ?? []).slice(0, 6).map((m) => m.id)]} />
    </article>
  );
}

// The picked hire at a glance: the job, how far it got, and how it ended.
function Summary({
  need,
  working,
  delivered,
  done,
  live,
  loaded,
  tried,
  winner,
}: {
  need: LiveNeed;
  working: boolean;
  delivered: boolean;
  done: boolean[];
  live: number;
  loaded: boolean;
  tried: number;
  winner: LiveTryout | null;
}) {
  const hold = need.hold ?? null;
  // "…" while the answer can still arrive, "None" once it cannot.
  const blank = working || !loaded ? "…" : "None";
  const checks = winner?.checks ?? [];
  const facts = [
    { label: "score", value: winner?.score != null ? winner.score.toFixed(1) : blank },
    { label: "checks", value: checks.length ? `${checks.filter((c) => c.passed).length}/${checks.length}` : blank },
    hold?.status === "captured"
      ? { label: "captured", value: money(capturedCents(hold)) }
      : hold?.status === "released"
        ? { label: "released", value: money(hold.amount_cents) }
        : { label: hold ? "held" : "captured", value: hold ? money(hold.amount_cents) : blank },
  ];

  return (
    <section aria-label="The job" className="flex flex-col gap-3.5 rounded-3xl bg-block-blue p-5 text-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
        <span>Hired by Claude Code</span>
        <span>{ROLE_LABEL[need.role] ?? need.role}</span>
        <span className="tabular-nums">{clock(need.created_at)}</span>
        <span className={`ml-auto font-medium text-white ${working ? "animate-pulse motion-reduce:animate-none" : ""}`}>
          {working ? "Working…" : delivered ? "Done" : "Nobody passed"}
        </span>
      </div>
      <p title={need.text} className="line-clamp-2 h-14 max-w-4xl text-lg leading-7 font-medium text-pretty sm:text-xl">
        {need.text}
      </p>

      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === live ? "step" : undefined} className="flex flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={`h-1 rounded-full transition-colors duration-300 ease-out ${done[i] ? "bg-white" : i === live ? "animate-pulse bg-white/60" : "bg-white/20"}`}
            />
            <span className={`truncate text-[11px] sm:text-xs ${done[i] || i === live ? "font-medium" : "text-white/70"}`}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-3 gap-x-6 gap-y-3 sm:flex sm:items-center sm:gap-x-8">
        <div className="col-span-3 flex h-10 min-w-0 items-center gap-3 sm:mr-auto">
          {need.result ? (
            <>
              <AgentAvatar card={{ id: need.result.agent_id, name: need.result.agent_name }} size="md" />
              <span className="truncate text-base font-semibold" translate="no">
                {need.result.agent_name} won
              </span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className={`size-10 shrink-0 rounded-full bg-white/20 ${working ? "animate-pulse motion-reduce:animate-none" : ""}`} />
              <span className="truncate text-base font-medium">
                {working ? (tried ? `Trying out ${tried} specialist${tried === 1 ? "" : "s"}…` : "Searching the Hub for specialists…") : "Nobody passed the proof"}
              </span>
            </>
          )}
        </div>
        <dl className="contents">
          {facts.map((f) => (
            <div key={f.label} className="flex h-10 flex-col justify-center sm:flex-row-reverse sm:items-baseline sm:gap-1.5">
              <dt className="truncate text-xs text-white/80 sm:text-sm">{f.label}</dt>
              <dd className="text-base font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
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
      className="flex flex-col gap-4 rounded-3xl animate-in fade-in duration-200 ease-out motion-reduce:animate-none"
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
  return <p className="mt-4 rounded-2xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function SearchMatches({ need, tried }: { need: LiveNeed; tried: Set<string> }) {
  const matches = need.search?.matches ?? [];
  if (!matches.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {matches.slice(0, 6).map((m) => {
        const on = tried.has(m.id);
        return (
          <li key={m.id} className={`flex items-center gap-3 rounded-2xl p-3 text-sm ${on ? "bg-(--hire-soft)" : "bg-muted"}`}>
            <AgentAvatar card={m} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold" translate="no">
                  {m.name}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{Math.round(m.similarity * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div className={`h-full rounded-full ${on ? "bg-primary" : "bg-foreground/30"}`} style={{ width: `${Math.max(4, Math.min(100, m.similarity * 100))}%` }} />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {m.builder}
                {on ? <span className="font-medium text-primary"> · tried out</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function useCountUp(target: number | null) {
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
      const p = Math.min(1, (t - start) / 700);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return v;
}

function Money({ hold: h, builder }: { hold: Hold; builder?: string }) {
  const captured = h.status === "captured";
  const released = h.status === "released";
  const steps: { key: string; on: boolean; title: React.ReactNode; detail: React.ReactNode }[] = [
    { key: "pay", on: true, title: h.via === "mpp" ? "MPP 402" : "Card", detail: h.via === "mpp" ? "Claude Code paid the HTTP 402" : "Card on file" },
    {
      key: "hold",
      on: true,
      title: <><Cents value={h.amount_cents} /> held</>,
      detail: h.spt ? <span className="font-mono text-xs">Shared Payment Token {h.spt}</span> : <Ref href={stripeLinks.payment(h.payment_intent)} id={h.payment_intent} />,
    },
    released
      ? { key: "release", on: true, title: "Released", detail: "No specialist passed, nothing charged" }
      : {
          key: "capture",
          on: captured,
          title: captured ? <><Cents value={capturedCents(h)} /> captured</> : "Capture",
          detail: captured ? <Ref href={stripeLinks.payment(h.payment_intent)} id={h.payment_intent} label="proof passed" /> : "Waits for the proof",
        },
    ...(released
      ? []
      : [
          {
            key: "payout",
            on: !!h.transfer,
            title: <>{h.builder_cents != null && h.transfer ? <Cents value={h.builder_cents} /> : "Payout"} to {builder ?? "the builder"}</>,
            detail: h.transfer ? <Ref href={stripeLinks.transfer(h.transfer)} id={h.transfer} label="via Connect" /> : "via Connect",
          },
        ]),
  ];
  return (
    <div>
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 md:flex-1">
            <div
              key={String(s.on)}
              style={{ animationDelay: `${i * 160}ms` }}
              className={`flex-1 rounded-2xl px-3.5 py-3 transition-colors duration-500 ease-out ${s.on ? `bg-muted text-foreground ${FEED_IN} fill-mode-both` : "bg-muted/50 text-muted-foreground"}`}
            >
              <div className="text-base font-semibold tabular-nums">{s.title}</div>
              <div className="mt-0.5 text-sm text-pretty [overflow-wrap:anywhere]">{s.detail}</div>
            </div>
            {i < steps.length - 1 ? <ArrowRight aria-hidden="true" className={`hidden size-4 shrink-0 md:block ${steps[i + 1].on ? "text-foreground" : "text-muted-foreground/40"}`} /> : null}
          </li>
        ))}
      </ol>
      {captured && h.blast_cents != null ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Blast kept <Cents value={h.blast_cents} />.
        </p>
      ) : null}
    </div>
  );
}

function Cents({ value }: { value: number }) {
  const v = useCountUp(value);
  return <span className="tabular-nums">{money(Math.round(v))}</span>;
}

function Ref({ href, id, label }: { href: string; id: string; label?: string }) {
  return (
    <span>
      {label ? `${label} ` : null}
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-(--hire) hover:underline">
        {id}
        <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      </a>
    </span>
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
      <div className="relative h-[420px] overflow-hidden rounded-2xl bg-white ring-1 ring-foreground/10">
        <iframe title={site.title} srcDoc={site.html} sandbox="" className="absolute top-0 left-0 h-[840px] w-[200%] origin-top-left scale-50 border-0" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">{site.title}</span>
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
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-4 font-medium transition-colors duration-150 ease-out hover:bg-secondary"
          >
            Open Live Site <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

// Every hire as a tile. Picking one swaps the view below in place; nothing navigates.
function History({ needs, focus, onPick }: { needs: LiveNeed[]; focus: string; onPick: (id: string) => void }) {
  return (
    <section aria-label="Hires">
      <ul className="flex gap-2 overflow-x-auto p-0.5">
        {needs.map((n) => {
          const on = n.id === focus;
          const released = n.status === "waiting" || n.hold?.status === "released";
          return (
            <li key={n.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(n.id)}
                aria-pressed={on}
                className={`relative flex h-[4.5rem] w-60 items-center after:absolute after:inset-y-0 after:left-full after:w-2 gap-3 rounded-2xl px-3 text-left text-sm transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] ${
                  on ? "bg-card ring-2 ring-primary" : "bg-muted hover:bg-secondary"
                }`}
              >
                {n.result?.agent_id ? (
                  <AgentAvatar card={{ id: n.result.agent_id, name: n.result.agent_name }} size="sm" />
                ) : (
                  <span aria-hidden="true" className={`size-8 shrink-0 rounded-full ${ACTIVE.has(n.status) ? "animate-pulse bg-primary" : "bg-secondary"}`} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{ROLE_LABEL[n.role] ?? n.role}</span>
                    <span className="tabular-nums">{clock(n.created_at)}</span>
                  </span>
                  <span className="block truncate font-medium">{n.text}</span>
                  <span className={`block truncate text-xs tabular-nums ${released ? "text-muted-foreground" : "font-medium"}`}>
                    {released
                      ? "Released, nobody passed"
                      : `${n.result?.agent_name ?? (ACTIVE.has(n.status) ? "In progress…" : "Done")}${n.hold?.status === "captured" ? ` · ${money(capturedCents(n.hold))}` : ""}`}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <LogoFactory ids={[...new Set(needs.map((n) => n.result?.agent_id).filter((x): x is string => !!x))]} />
    </section>
  );
}
