"use client";

import { ArrowRight, Check, ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { Candidate } from "./candidate";
import { db } from "./db";
import { clock, money, ROLE_LABEL, ROLE_TOOLS } from "./format";
import { Policy } from "./hires";
import { BlastMark, type Brand, Logo } from "./logos";
import { capturedCents, ClaimCodes, type Claim, type Estimate, EstimateTable, type Hold, isEstimate, type LiveNeed, type LiveTryout, stripeLinks } from "./proof";
import { Scorecard } from "./scorecard";
import { useNeed } from "./use-need";
import { SpeakButton } from "./voice";

type Site = { title: string; palette: string[]; fonts: { display: string; body: string }; html: string; live_url: string };

const MCP = "claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp";

const FEED_IN = "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none";
const ACTIVE = new Set(["auditioning", "checkout"]);
const TILE = "h-[4.5rem] w-60 shrink-0 rounded-2xl";

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

// Variant A: one page. A slim summary on top, then one row per stage that opens in place.
export function DashboardA({ initialNeed }: { initialNeed: string | null }) {
  const needs = useHires();
  const [picked, setPicked] = useState<string | null>(initialNeed);
  const newest = needs?.[0]?.id ?? null;
  const [seen, setSeen] = useState<string | null>(null);

  // A new hire always takes focus, even after a click on an older one.
  if (newest && newest !== seen) {
    setSeen(newest);
    if (seen) setPicked(null);
  }
  const focus = picked ?? newest;
  const captured = (needs ?? []).filter((n) => n.hold?.status === "captured");
  const stats = [
    { label: "Hires", value: needs ? String(needs.length) : null },
    { label: "Paid on proof", value: needs ? String(captured.length) : null },
    { label: "Captured", value: needs ? money(captured.reduce((a, n) => a + (n.hold ? capturedCents(n.hold) : 0), 0)) : null },
    { label: "Released", value: needs ? money(needs.reduce((a, n) => a + (n.hold?.status === "released" ? n.hold.amount_cents : 0), 0)) : null },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-6 pb-16">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-3xl bg-block-dark px-5 py-2.5 text-white">
        <h1 className="text-xl font-normal tracking-tight">Agents That Hire Agents</h1>
        <dl className="grid grid-cols-4 gap-x-2 max-lg:order-last max-lg:w-full sm:gap-x-6">
          {stats.map((s) => (
            <div key={s.label} className="min-w-16">
              <dd className="h-6 text-lg leading-6 font-semibold tabular-nums">
                {s.value ?? <span className="animate-pulse text-white/40 motion-reduce:animate-none">…</span>}
              </dd>
              <dt className="truncate text-[11px] text-white/70 sm:text-xs">{s.label}</dt>
            </div>
          ))}
        </dl>
        <div className="w-full sm:ml-auto sm:w-auto">
          <Policy />
        </div>
      </div>

      {!needs ? (
        <Loading />
      ) : !focus ? (
        <Empty />
      ) : (
        <>
          <History needs={needs} focus={focus} onPick={setPicked} />
          <Focus key={focus} id={focus} fallback={needs.find((n) => n.id === focus) ?? null} />
        </>
      )}
    </main>
  );
}

// Holds the place of the tiles and the summary until the first read lands.
function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div aria-hidden="true" className="flex gap-2 overflow-hidden p-0.5 pb-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`${TILE} animate-pulse bg-muted motion-reduce:animate-none`} />
        ))}
      </div>
      <p className="flex h-64 items-center justify-center rounded-3xl bg-muted text-sm text-muted-foreground">Loading hires…</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl bg-block-blue px-6 py-16 text-center text-white">
      <p className="mx-auto flex w-fit items-center gap-2.5 text-xl">
        <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
        Waiting for an Agent to Hire…
      </p>
      <p className="mt-6 text-sm text-white/90">Connect Claude Code to Blast:</p>
      <code className="mt-2 inline-block max-w-full overflow-x-auto rounded-xl bg-white/15 px-4 py-2.5 font-mono text-[13px] select-all">{MCP}</code>
    </div>
  );
}

const STEPS = ["Search", "Tryouts", "Paid on Proof", "Delivered"];

function Focus({ id, fallback }: { id: string; fallback: LiveNeed | null }) {
  const view = useNeed(id);
  // A stage opens by itself when it is the live one; a click wins from then on.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const need = (view.need as LiveNeed | null) ?? fallback;
  if (!need) return null;
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

  // While the hire is live the cards sit in the blue block; after that, one result line.
  const onStage = working || running;
  const top = field.find((a) => a.id === (winnerId ?? best)) ?? null;
  const topTryout = top ? byAgent.get(top.id) : undefined;
  const hold = need.hold ?? null;
  const matches = need.search?.matches ?? [];
  const scored = tryouts.some((t) => t.checks?.length);
  const topScore = ranked.length ? byAgent.get(ranked[0].id)?.score : null;

  const section = (key: string, auto: boolean) => ({
    open: toggled[key] ?? auto,
    onToggle: () => setToggled((t) => ({ ...t, [key]: !(t[key] ?? auto) })),
  });

  const cards = (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-3">
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
    </ul>
  );

  return (
    <article className="flex flex-col gap-4">
      <section aria-label="The job" className="flex flex-col gap-3.5 rounded-3xl bg-block-blue p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 font-medium text-primary">
            <BlastMark className="size-4" live={working} /> Hired by Claude Code over MCP
          </span>
          <span>{ROLE_LABEL[need.role] ?? need.role}</span>
          <span className="tabular-nums">{clock(need.created_at)}</span>
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${working ? "animate-pulse bg-white/20 motion-reduce:animate-none" : delivered ? "bg-success" : "bg-white/20"}`}>
            {working ? "Working…" : delivered ? "Done" : "Nobody Passed"}
          </span>
        </div>
        <p title={need.text} className="line-clamp-2 max-w-4xl text-xl leading-snug font-medium text-pretty">{need.text}</p>

        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === live ? "step" : undefined} className="flex flex-col gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-colors duration-300 ease-out ${
                  done[i] ? "bg-white" : i === live ? "animate-pulse bg-white/60 motion-reduce:animate-none" : "bg-white/20"
                }`}
              />
              <span className={`truncate text-[11px] sm:text-xs ${done[i] || i === live ? "font-medium" : "text-white/85"}`}>{label}</span>
            </li>
          ))}
        </ol>

        {onStage ? (
          <div className="grid min-h-[15.5rem]">
            {field.length ? cards : <p className="flex items-center justify-center rounded-2xl bg-white/15 text-sm">Searching the Hub for specialists…</p>}
          </div>
        ) : (
          <dl aria-label="Result" className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <div className="col-span-2 flex h-14 items-center gap-2.5 rounded-2xl bg-white/10 px-3 sm:col-span-1">
              {top ? <AgentAvatar card={top} size="sm" /> : <span aria-hidden="true" className="size-8 shrink-0 rounded-full bg-white/20" />}
              <div className="min-w-0">
                <dd className="truncate text-base leading-6 font-semibold" translate="no">
                  {top?.name ?? need.result?.agent_name ?? (tryouts.length ? "Nobody" : "…")}
                </dd>
                <dt className="text-xs">{delivered ? "Winner" : "Top score, did not pass"}</dt>
              </div>
            </div>
            <Fact label="Score out of 10" value={topTryout?.score != null ? topTryout.score.toFixed(1) : null} />
            <Fact
              label="Checks passed"
              value={topTryout?.checks?.length ? `${topTryout.checks.filter((c) => c.passed).length}/${topTryout.checks.length}` : null}
            />
            <Fact
              label={hold?.status === "captured" ? "Captured" : hold?.status === "released" ? "Released, not charged" : "Held"}
              value={hold ? money(hold.status === "captured" ? capturedCents(hold) : hold.amount_cents) : null}
              wide
            />
          </dl>
        )}
      </section>

      {need.result?.summary ? (
        <section className={`rounded-3xl bg-success/10 px-5 py-4 ${FEED_IN}`}>
          <h2 className="text-sm font-semibold text-success">What Happened</h2>
          <p className="mt-1 max-w-4xl text-base leading-relaxed text-pretty whitespace-pre-line">{bold(need.result.summary)}</p>
        </section>
      ) : null}

      <Stage
        title="Delivered work"
        value={need.result ? `From ${need.result.agent_name}` : "Not yet"}
        done={delivered}
        now={live === 3}
        {...section("delivered", delivered)}
      >
        {need.result ? <Delivered result={need.result} /> : null}
      </Stage>
      <Stage
        title="Tryouts"
        value={
          !tryouts.length
            ? "Not yet"
            : running
              ? `${tryouts.length} trying out…`
              : `${tryouts.length} tried out${topScore != null ? `, top score ${topScore.toFixed(1)}` : ""}`
        }
        done={auditioned}
        now={live === 1}
        {...section("tryouts", onStage)}
      >
        {(!onStage && field.length) || scored ? (
          <div className="flex flex-col gap-5 [&>section]:rounded-none [&>section]:p-0 [&>section]:ring-0">
            {onStage ? null : <div className="rounded-2xl bg-muted p-3">{cards}</div>}
            <Scorecard agents={field} ranks={running ? null : ranked.map((a) => a.id)} byAgent={byAgent} winnerId={running ? null : (winnerId ?? best)} tools={ROLE_TOOLS[need.role] ?? []} />
          </div>
        ) : null}
      </Stage>
      <Stage
        title="Payment"
        logos={["stripe"]}
        value={
          !hold
            ? "Not yet"
            : hold.status === "captured"
              ? `${money(capturedCents(hold))} captured of ${money(hold.amount_cents)}`
              : `${money(hold.amount_cents)} ${hold.status}`
        }
        done={paid}
        now={live === 2}
        {...section("payment", false)}
      >
        {hold ? <Money hold={hold} builder={winnerId ? field.find((a) => a.id === winnerId)?.builder : undefined} /> : null}
      </Stage>
      <Stage
        title="Search"
        logos={["supabase"]}
        value={need.search ? `${tryouts.length} of ${need.search.listings} tried out` : searched ? `${tryouts.length} tried out` : "Searching…"}
        done={searched}
        now={live === 0}
        {...section("search", false)}
      >
        {matches.length ? <SearchMatches need={need} tried={new Set(tryouts.map((t) => t.agent_id))} /> : null}
      </Stage>
      <LogoFactory ids={[...field.map((a) => a.id), ...matches.slice(0, 6).map((m) => m.id)]} />
    </article>
  );
}

// A number first, its label under it. A missing value keeps the tile's size.
function Fact({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={`flex h-14 flex-col justify-center rounded-2xl bg-white/10 px-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <dd className="h-6 text-lg leading-6 font-semibold tabular-nums">{value ?? <span aria-hidden="true">…</span>}</dd>
      <dt className="truncate text-xs">{label}</dt>
    </div>
  );
}

// One stage as one row: its state, its name, its key number. The row opens the detail in place.
function Stage({
  title,
  value,
  logos = [],
  done,
  now,
  open,
  onToggle,
  children,
}: {
  title: string;
  value: string;
  logos?: Brand[];
  done: boolean;
  now: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panel = useId();
  const shown = open && !!children;
  return (
    <section className="rounded-2xl bg-card ring-1 ring-foreground/10">
      <h2>
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={panel}
          disabled={!children}
          onClick={onToggle}
          className="flex h-14 w-full items-center gap-2.5 rounded-2xl px-4 text-left outline-none transition-colors duration-150 ease-out hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary disabled:hover:bg-transparent"
        >
          <span className="grid size-6 shrink-0 place-items-center">
            {done ? (
              <span className="grid size-5 place-items-center rounded-full bg-success text-white">
                <Check aria-hidden="true" className="size-3" strokeWidth={3.5} />
              </span>
            ) : (
              <span aria-hidden="true" className={`size-2.5 rounded-full ${now ? "animate-pulse bg-primary motion-reduce:animate-none" : "bg-secondary"}`} />
            )}
          </span>
          <span className="shrink-0 text-base font-semibold">{title}</span>
          {logos.map((b) => (
            <Logo key={b} brand={b} className="size-4 shrink-0" />
          ))}
          <span className={`ml-auto min-w-0 truncate text-sm tabular-nums ${done ? "font-medium" : "text-muted-foreground"}`}>{value}</span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none ${shown ? "rotate-180" : ""} ${children ? "" : "opacity-0"}`}
          />
        </button>
      </h2>
      <div id={panel} hidden={!shown} className="px-4 pt-1 pb-4 sm:px-5 sm:pb-5">
        {shown ? <div className={FEED_IN}>{children}</div> : null}
      </div>
    </section>
  );
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
              className={`flex-1 rounded-2xl px-3.5 py-3 transition-colors duration-500 ease-out ${s.on ? `bg-success/10 text-foreground ${FEED_IN} fill-mode-both` : "bg-muted text-muted-foreground"}`}
            >
              <div className="text-lg font-semibold tabular-nums">{s.title}</div>
              <div className="mt-0.5 text-sm text-pretty [overflow-wrap:anywhere]">{s.detail}</div>
            </div>
            {i < steps.length - 1 ? <ArrowRight className={`hidden size-4 shrink-0 md:block ${steps[i + 1].on ? "text-success" : "text-muted-foreground/40"}`} /> : null}
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
        <ExternalLink className="size-3 shrink-0" />
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
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
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
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="overflow-hidden rounded-2xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-secondary" />
            <span className="size-2.5 rounded-full bg-secondary" />
            <span className="size-2.5 rounded-full bg-secondary" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-card px-2 py-0.5 text-center font-mono text-xs text-muted-foreground">{site.live_url || site.title}</span>
        </div>
        <div className="relative h-[420px] overflow-hidden bg-white">
          <iframe title={site.title} srcDoc={site.html} sandbox="" className="absolute top-0 left-0 h-[840px] w-[200%] origin-top-left scale-50 border-0" />
        </div>
      </div>
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Site</div>
          <div className="text-lg font-semibold">{site.title}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Palette</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {site.palette.map((c) => (
              <span key={c} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2 pl-0.5 font-mono text-xs">
                <span aria-hidden="true" className="size-5 rounded-full ring-1 ring-foreground/10" style={{ background: c }} />
                {c}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Type</div>
          <div className="mt-0.5">
            {site.fonts.display} <span className="text-muted-foreground">/</span> {site.fonts.body}
          </div>
        </div>
        {site.live_url ? (
          <a
            href={site.live_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-primary px-4 font-medium text-white transition-colors duration-150 ease-out hover:bg-primary/90"
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
      <ul className="flex gap-2 overflow-x-auto p-0.5 pb-2">
        {needs.map((n) => {
          const on = n.id === focus;
          const released = n.status === "waiting" || n.hold?.status === "released";
          return (
            <li key={n.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(n.id)}
                aria-pressed={on}
                className={`relative flex ${TILE} items-center gap-3 px-3 text-left text-sm after:absolute after:inset-y-0 after:left-full after:w-2 transition-[background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] ${
                  on ? "bg-card ring-2 ring-primary" : "bg-muted hover:bg-secondary"
                }`}
              >
                {n.result?.agent_id ? (
                  <AgentAvatar card={{ id: n.result.agent_id, name: n.result.agent_name }} size="sm" />
                ) : (
                  <span aria-hidden="true" className={`size-8 shrink-0 rounded-full ${ACTIVE.has(n.status) ? "animate-pulse bg-primary motion-reduce:animate-none" : "bg-secondary"}`} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{ROLE_LABEL[n.role] ?? n.role}</span>
                    <span className="tabular-nums">{clock(n.created_at)}</span>
                  </span>
                  <span className="block truncate font-medium">{n.text}</span>
                  <span className={`block truncate text-xs tabular-nums ${released ? "text-muted-foreground" : "font-medium text-success"}`}>
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
