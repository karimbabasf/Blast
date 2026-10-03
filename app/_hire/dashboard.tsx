"use client";

import { ArrowRight, Check, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketAgent, TryoutStep } from "@/lib/market/types";
import { db } from "./db";
import { clock, modelName, money, outcome, ROLE_LABEL, summarize } from "./format";
import { Policy } from "./hires";
import { BlastMark, type Brand, labOf, Logo } from "./logos";
import { capturedCents, ClaimCodes, type Claim, type Estimate, EstimateTable, type Hold, isEstimate, type LiveNeed, type LiveTryout, stripeLinks } from "./proof";
import { useNeed } from "./use-need";

type Site = { title: string; palette: string[]; fonts: { display: string; body: string }; html: string; live_url: string };

const MCP = "claude mcp add --transport http blast https://blast-kbkotes-projects.vercel.app/api/mcp";

const CARD = "rounded-2xl bg-white shadow-[0_1px_2px_rgb(70_50_30/0.06),0_12px_32px_-16px_rgb(70_50_30/0.18)]";
const FEED_IN = "animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none";

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

export function Dashboard({ initialNeed }: { initialNeed: string | null }) {
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <BlastMark className="mt-1 size-10 shrink-0" live={!!needs?.[0] && (needs[0].status === "auditioning" || needs[0].status === "checkout")} />
          <div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] text-stone-900">Agents that hire agents.</h1>
            <p className="mt-1 max-w-xl text-[15px] text-pretty text-stone-600">
              When your agent hits work it can&apos;t do, it hires a specialist on Blast. Tried out live, paid on proof.
            </p>
          </div>
        </div>
        <Policy compact />
      </div>

      {!needs ? null : !focus ? (
        <Empty />
      ) : (
        <>
          <Focus key={focus} id={focus} fallback={needs.find((n) => n.id === focus) ?? null} />
          {needs.length > 1 ? <History needs={needs} focus={focus} onPick={setPicked} /> : null}
        </>
      )}
    </main>
  );
}

function Empty() {
  return (
    <div className={`${CARD} mt-8 px-6 py-16 text-center`}>
      <div className="mx-auto flex w-fit items-center gap-2.5 text-xl text-stone-700">
        <span className="size-2.5 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" />
        Waiting for an agent to hire...
      </div>
      <p className="mt-6 text-sm text-stone-500">Connect Claude Code to Blast:</p>
      <code className="mt-2 inline-block max-w-full overflow-x-auto rounded-lg bg-stone-100 px-4 py-2.5 font-mono text-[13px] text-stone-800 select-all">
        {MCP}
      </code>
    </div>
  );
}

function Focus({ id, fallback }: { id: string; fallback: LiveNeed | null }) {
  const view = useNeed(id);
  const need = (view.need as LiveNeed | null) ?? fallback;
  if (!need) return null;
  const tryouts = view.tryouts as LiveTryout[];
  const winnerId = need.result?.agent_id ?? need.hold?.agent_id ?? null;
  const running = tryouts.some((t) => t.status === "running");
  const agents = new Map(view.agents.map((a) => [a.id, a]));

  const searched = !!need.search || tryouts.length > 0;
  const auditioned = tryouts.length > 0 && !running;
  const paid = need.hold?.status === "captured" || need.hold?.status === "released";
  const delivered = !!need.result;
  const live = !searched ? 0 : !auditioned ? 1 : !paid ? 2 : !delivered ? 3 : -1;

  return (
    <article className="mt-6">
      <div className={`${CARD} px-6 py-5`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
          <span className="rounded-full bg-(--hire-soft) px-2.5 py-0.5 font-medium text-(--hire)">Hired by Claude Code over MCP</span>
          <span>{ROLE_LABEL[need.role] ?? need.role}</span>
          <span className="tabular-nums">{clock(need.created_at)}</span>
        </div>
        <p className="mt-3 max-w-4xl text-lg leading-snug sm:text-[22px] font-medium text-pretty text-stone-900">{need.text}</p>
        {need.result?.summary ? (
          <div className={`mt-5 rounded-xl bg-emerald-50/70 px-5 py-4 ${FEED_IN}`}>
            <h2 className="text-sm font-semibold text-emerald-900">What happened</h2>
            <p className="mt-1.5 max-w-4xl text-[19px] leading-relaxed text-pretty whitespace-pre-line text-stone-900">{bold(need.result.summary)}</p>
          </div>
        ) : null}
      </div>

      <ol className="mt-4 space-y-4">
        <Phase n={0} live={live} done={searched} title="Searching Blast Hub" logos={["supabase"]} sub={`pgvector semantic search over ${need.search?.listings ?? "the"} agents`}>
          <SearchMatches need={need} tried={new Set(tryouts.map((t) => t.agent_id))} />
        </Phase>
        <Phase n={1} live={live} done={auditioned} title="Auditioning on your job" logos={["vercel", "supabase"]} sub="Each candidate runs in a Vercel Function on a private Supabase copy">
          {tryouts.length ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
              {tryouts.map((t) => (
                <Lane key={t.id} tryout={t} agent={agents.get(t.agent_id)} steps={view.steps.filter((s) => s.tryout_id === t.id)} winner={!running && t.agent_id === winnerId} />
              ))}
            </div>
          ) : null}
        </Phase>
        <Phase n={2} live={live} done={paid} title="Paid on proof" logos={["stripe"]} sub="Held before the work, captured only when the winner passed">
          {need.hold ? <Money hold={need.hold} builder={winnerId ? agents.get(winnerId)?.builder : undefined} /> : null}
        </Phase>
        <Phase n={3} live={live} done={delivered} title="Delivered to Claude Code" logos={[]} sub={need.result ? `The work from ${need.result.agent_name}` : "The winner's work goes back over MCP"}>
          {need.result ? <Delivered result={need.result} /> : null}
        </Phase>
      </ol>
    </article>
  );
}

function Phase({
  n,
  live,
  done,
  title,
  sub,
  logos,
  children,
}: {
  n: number;
  live: number;
  done: boolean;
  title: string;
  sub: string;
  logos: Brand[];
  children: React.ReactNode;
}) {
  const now = live === n;
  const waiting = !done && !now;
  return (
    <li className={`${CARD} px-6 py-5 transition-opacity duration-500 ease-out ${waiting ? "opacity-55" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="grid size-6 shrink-0 place-items-center">
          {done ? (
            <span className="grid size-6 place-items-center rounded-full bg-emerald-600 text-white">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          ) : now ? (
            <span className="size-3 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" />
          ) : (
            <span className="size-2.5 rounded-full bg-stone-300" />
          )}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h2>
        {logos.length ? (
          <span className="flex items-center gap-1.5 text-stone-900">
            {logos.map((b) => (
              <Logo key={b} brand={b} className="size-[18px]" />
            ))}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-stone-600 sm:pl-9">{sub}</p>
      {children ? <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none sm:pl-9">{children}</div> : null}
    </li>
  );
}

function SearchMatches({ need, tried }: { need: LiveNeed; tried: Set<string> }) {
  const matches = need.search?.matches ?? [];
  if (!matches.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {matches.slice(0, 6).map((m) => {
        const on = tried.has(m.id);
        return (
          <li key={m.id} className={`rounded-xl px-3 py-2 text-sm ${on ? "bg-(--hire-soft)" : "bg-stone-50"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="font-medium text-stone-900">{m.name}</span> <span className="text-stone-500">{m.builder}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-stone-700">{m.similarity.toFixed(2)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
              <div className={`h-full rounded-full ${on ? "bg-(--hire)" : "bg-stone-400"}`} style={{ width: `${Math.max(4, Math.min(100, m.similarity * 100))}%` }} />
            </div>
            {on ? <div className="mt-1 text-xs font-medium text-(--hire)">Auditioned</div> : null}
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

function Lane({ tryout: t, agent, steps, winner }: { tryout: LiveTryout; agent?: MarketAgent; steps: TryoutStep[]; winner: boolean }) {
  const score = useCountUp(t.status === "scored" ? t.score : null);
  const lab = agent ? labOf(agent.model) : null;
  const tools = steps.filter((s) => s.kind === "tool").slice(-6);
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 transition-shadow duration-500 ease-out ${
        winner ? "border-(--hire)/40 bg-white shadow-[0_2px_4px_rgb(40_60_160/0.08),0_18px_40px_-18px_rgb(40_60_160/0.35)]" : "border-stone-200 bg-stone-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold text-stone-900">{agent?.name ?? "Specialist"}</span>
            {winner ? <span className="rounded-full bg-(--hire) px-2 py-0.5 text-xs font-medium text-white">Hired</span> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-600">
            {lab ? <Logo brand={lab} className="size-3.5" /> : null}
            <span className="truncate">
              {agent ? modelName(agent.model) : ""} {agent ? <span className="text-stone-400">by {agent.builder}</span> : null}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {t.status === "running" ? (
            <span className="mt-2 block size-2.5 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" aria-label="working" />
          ) : t.status === "scored" ? (
            <div className="text-2xl leading-none font-semibold tabular-nums text-stone-900">
              {score.toFixed(1)}
              <span className="ml-0.5 text-xs font-normal text-stone-500">/10</span>
            </div>
          ) : (
            <span className="text-sm text-red-700">Failed</span>
          )}
        </div>
      </div>

      <ol className="mt-3 min-h-24 space-y-1 font-mono text-[13px] leading-snug text-stone-700">
        {tools.map((s) => (
          <li key={s.id} className={FEED_IN}>
            <span className="text-(--hire)">{s.name}</span> {summarize(s.name, s.input)}
            {outcome(s.name, s.output) ? <span className="text-stone-500"> -&gt; {outcome(s.name, s.output)}</span> : null}
          </li>
        ))}
        {!tools.length ? <li className="text-stone-400">Starting</li> : null}
      </ol>

      {t.checks?.length ? (
        <ul className="mt-3 space-y-0.5 border-t border-stone-200 pt-3 text-sm">
          {t.checks.map((c) => (
            <li key={c.name} className={`flex items-start gap-1.5 ${FEED_IN}`}>
              {c.passed ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 size-4 shrink-0 text-red-600" />}
              <span className={c.passed ? "text-stone-800" : "text-stone-500"}>{c.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {t.usage?.cost_usd != null ? (
        <p className="mt-2 text-xs text-stone-500 tabular-nums">
          ${t.usage.cost_usd.toFixed(4)} in tokens{agent ? ` · ${money(agent.price_action_cents)} per job` : ""}
        </p>
      ) : null}
    </div>
  );
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
              className={`flex-1 rounded-xl px-3.5 py-3 transition-colors duration-500 ease-out ${s.on ? `bg-emerald-50 text-emerald-950 ${FEED_IN} fill-mode-both` : "bg-stone-50 text-stone-500"}`}
            >
              <div className="text-[17px] font-semibold tabular-nums">{s.title}</div>
              <div className="mt-0.5 text-sm text-pretty [overflow-wrap:anywhere]">{s.detail}</div>
            </div>
            {i < steps.length - 1 ? <ArrowRight className={`hidden size-4 shrink-0 md:block ${steps[i + 1].on ? "text-emerald-600" : "text-stone-300"}`} /> : null}
          </li>
        ))}
      </ol>
      {captured && h.blast_cents != null ? (
        <p className="mt-2 text-sm text-stone-600">
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
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-stone-900">{part}</strong> : part));
}

function isSite(o: unknown): o is Site {
  return !!o && typeof o === "object" && typeof (o as Site).html === "string";
}

function Delivered({ result }: { result: NonNullable<LiveNeed["result"]> }) {
  const out = result.output as Estimate | Claim | Site | null;
  return (
    <div>
      {result.reply ? <p className="max-w-3xl text-[17px] leading-relaxed text-pretty whitespace-pre-line text-stone-800">{bold(result.reply)}</p> : null}
      {isSite(out) ? <SitePreview site={out} /> : out ? isEstimate(out as Estimate | Claim) ? <EstimateTable e={out as Estimate} /> : <ClaimCodes c={out as Claim} /> : null}
    </div>
  );
}

function SitePreview({ site }: { site: Site }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="overflow-hidden rounded-xl border border-stone-200 shadow-[0_12px_32px_-16px_rgb(70_50_30/0.3)]">
        <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-stone-300" />
            <span className="size-2.5 rounded-full bg-stone-300" />
            <span className="size-2.5 rounded-full bg-stone-300" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-center font-mono text-xs text-stone-500">{site.live_url || site.title}</span>
        </div>
        <div className="relative h-[420px] overflow-hidden bg-white">
          <iframe
            title={site.title}
            srcDoc={site.html}
            sandbox=""
            className="absolute top-0 left-0 h-[840px] w-[200%] origin-top-left scale-50 border-0"
          />
        </div>
      </div>
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-stone-500">Site</div>
          <div className="text-lg font-semibold text-stone-900">{site.title}</div>
        </div>
        <div>
          <div className="text-stone-500">Palette</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {site.palette.map((c) => (
              <span key={c} className="flex items-center gap-1.5 rounded-full bg-stone-50 py-0.5 pr-2 pl-0.5 font-mono text-xs text-stone-700">
                <span className="size-5 rounded-full border border-black/10" style={{ background: c }} />
                {c}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-stone-500">Type</div>
          <div className="mt-0.5 text-stone-900">
            {site.fonts.display} <span className="text-stone-400">/</span> {site.fonts.body}
          </div>
        </div>
        {site.live_url ? (
          <a href={site.live_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-(--hire) px-3.5 font-medium text-white hover:bg-(--hire)/90">
            Open live site <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function History({ needs, focus, onPick }: { needs: LiveNeed[]; focus: string; onPick: (id: string) => void }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-stone-600">Earlier hires</h2>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {needs.map((n) => (
          <li key={n.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(n.id)}
              aria-pressed={n.id === focus}
              className={`w-64 rounded-xl px-3.5 py-2.5 text-left text-sm transition-shadow duration-200 ease-out hover:shadow-[0_8px_20px_-12px_rgb(70_50_30/0.3)] ${
                n.id === focus ? "bg-(--hire-soft) ring-1 ring-(--hire)/40" : "bg-white shadow-[0_1px_2px_rgb(70_50_30/0.06)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                <span>{ROLE_LABEL[n.role] ?? n.role}</span>
                <span className="tabular-nums">{clock(n.created_at)}</span>
              </div>
              <div className="mt-1 line-clamp-1 font-medium text-stone-900">{n.text}</div>
              {n.status === "waiting" || n.hold?.status === "released" ? (
                <div className="mt-1 text-xs text-stone-400">Released, nobody passed</div>
              ) : (
                <div className="mt-1 text-xs text-stone-600 tabular-nums">
                  {n.result?.agent_name ?? (n.status === "auditioning" || n.status === "checkout" ? "In progress" : n.status === "hired" ? "Done" : n.status)}
                  {n.hold?.status === "captured" ? ` · ${money(capturedCents(n.hold))} captured` : ""}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
