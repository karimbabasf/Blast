"use client";

import { ArrowRight, Check, ChevronRight, ExternalLink, X } from "lucide-react";
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
    <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BlastMark className="size-8 shrink-0" live={!!needs?.[0] && (needs[0].status === "auditioning" || needs[0].status === "checkout")} />
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-stone-900">Agents that hire agents.</h1>
          <p className="hidden text-sm text-stone-500 md:block">When your agent hits work it can&apos;t do, it hires a specialist on Blast. Tried out live, paid on proof.</p>
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
  const [jobOpen, setJobOpen] = useState(false);
  if (!need) return null;
  const tryouts = view.tryouts as LiveTryout[];
  const winnerId = need.result?.agent_id ?? need.hold?.agent_id ?? null;
  const running = tryouts.some((t) => t.status === "running");
  const agents = new Map(view.agents.map((a) => [a.id, a]));
  const h = need.hold;
  const released = need.status === "waiting" || h?.status === "released";

  const searched = !!need.search || tryouts.length > 0;
  const auditioned = tryouts.length > 0 && !running;
  const paid = h?.status === "captured" || h?.status === "released";
  const delivered = !!need.result;
  const live = !searched ? 0 : !auditioned ? 1 : !paid ? 2 : !delivered ? 3 : -1;
  const ranked = [...tryouts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const top = ranked[0];
  const winner = winnerId ? agents.get(winnerId) : undefined;
  const steps = (t: LiveTryout) => view.steps.filter((s) => s.tryout_id === t.id);

  const stepper: { title: string; logos: Brand[]; done: boolean; value: string }[] = [
    { title: "Search", logos: ["supabase"], done: searched, value: need.search ? `${need.search.listings} agents searched` : "Searching" },
    {
      title: "Audition",
      logos: ["vercel"],
      done: auditioned,
      value: !tryouts.length ? "Waiting" : running ? `${tryouts.length} running` : `${tryouts.length} auditioned${top?.score != null ? `, ${agents.get(top.agent_id)?.name ?? ""} ${top.score.toFixed(1)}` : ""}`,
    },
    {
      title: "Paid on proof",
      logos: ["stripe"],
      done: paid,
      value: !h ? "Not held yet" : released ? "Released, nothing charged" : h.status === "captured" ? `${money(capturedCents(h))} of ${money(h.amount_cents)}${h.builder_cents != null ? `, builder ${money(h.builder_cents)}` : ""}` : `${money(h.amount_cents)} held`,
    },
    { title: "Delivered", logos: [], done: delivered, value: delivered ? "Delivered" : released ? "Nothing to deliver" : "Waiting" },
  ];

  const lanes = (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
      {tryouts.map((t) => (
        <Lane key={t.id} tryout={t} agent={agents.get(t.agent_id)} steps={steps(t)} winner={!running && t.agent_id === winnerId} />
      ))}
    </div>
  );

  return (
    <article className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className={`${CARD} min-w-0 px-5 py-4`}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500">
          <span className="rounded-full bg-(--hire-soft) px-2 py-0.5 font-medium text-(--hire)">Hired by Claude Code over MCP</span>
          <span>{ROLE_LABEL[need.role] ?? need.role}</span>
          <span className="tabular-nums">{clock(need.created_at)}</span>
        </div>
        <button type="button" onClick={() => setJobOpen((o) => !o)} className="mt-2 block text-left" aria-expanded={jobOpen} title={jobOpen ? "Show less" : "Show the whole job"}>
          <p className={`text-[15px] leading-snug text-pretty text-stone-700 ${jobOpen ? "" : "line-clamp-2"}`}>{need.text}</p>
        </button>

        {need.result?.summary ? (
          <div className={`mt-3 ${FEED_IN}`}>
            <h2 className="text-xs font-semibold tracking-wide text-emerald-800 uppercase">What happened</h2>
            <p className="mt-1 text-[19px] leading-[1.45] font-medium text-pretty whitespace-pre-line text-stone-900">{bold(need.result.summary)}</p>
          </div>
        ) : null}

        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stepper.map((s, i) => (
            <li
              key={s.title}
              className={`rounded-xl px-3 py-2.5 transition-colors duration-500 ease-out ${s.done ? "bg-emerald-50" : live === i ? "bg-(--hire-soft)" : "bg-stone-50"}`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
                {s.done ? <Check className="size-3.5 text-emerald-600" strokeWidth={3} /> : live === i ? <span className="size-2 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" /> : <span className="size-2 rounded-full bg-stone-300" />}
                {s.title}
                <span className="ml-auto flex gap-1 text-stone-900">
                  {s.logos.map((b) => (
                    <Logo key={b} brand={b} className="size-3.5" />
                  ))}
                </span>
              </div>
              <div className="mt-1 text-[13px] leading-snug font-semibold text-stone-900 tabular-nums">{s.value}</div>
            </li>
          ))}
        </ol>

        {ranked.length ? (
          <table className="mt-4 w-full text-sm tabular-nums">
            <tbody>
              {ranked.map((t) => {
                const a = agents.get(t.agent_id);
                const lab = a ? labOf(a.model) : null;
                const passed = t.checks?.filter((c) => c.passed).length ?? 0;
                const win = !running && t.agent_id === winnerId;
                return (
                  <tr key={t.id} className={win ? "bg-(--hire-soft)" : ""}>
                    <td className="rounded-l-lg py-1.5 pl-2.5">
                      <span className="flex items-center gap-1.5 font-medium text-stone-900">
                        {lab ? <Logo brand={lab} className="size-3.5 shrink-0" /> : null}
                        {a?.name ?? "Specialist"}
                        {win ? <span className="rounded-full bg-(--hire) px-1.5 py-px text-[10px] font-medium text-white">Hired</span> : null}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-semibold text-stone-900">
                      {t.status === "running" ? <span className="ml-auto block size-2 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" /> : t.score != null ? <Score value={t.score} /> : "Failed"}
                    </td>
                    <td className="py-1.5 text-right text-stone-600">{t.checks?.length ? `${passed}/${t.checks.length} checks` : ""}</td>
                    <td className="rounded-r-lg py-1.5 pr-2.5 text-right text-stone-500">{t.usage?.cost_usd != null ? `$${t.usage.cost_usd.toFixed(4)}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        <div className="mt-3 divide-y divide-stone-100 border-t border-stone-100">
          {delivered && tryouts.length ? <Fold label="Tool calls and checks">{lanes}</Fold> : null}
          {need.search?.matches?.length ? (
            <Fold label={`Search matches (${need.search.matches.length})`}>
              <SearchMatches need={need} tried={new Set(tryouts.map((t) => t.agent_id))} />
            </Fold>
          ) : null}
          {h ? (
            <Fold label="Payment and Stripe ids">
              <Money hold={h} builder={winner?.builder} />
            </Fold>
          ) : null}
        </div>
      </div>

      <div className={`${CARD} min-w-0 px-5 py-4`}>
        {need.result ? (
          <Delivered result={need.result} />
        ) : tryouts.length ? (
          <div className={FEED_IN}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
              <span className="size-2.5 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" />
              {released ? "Nobody passed" : "Auditioning on your job"}
              <Logo brand="vercel" className="size-4 text-stone-900" />
              <Logo brand="supabase" className="size-4" />
            </h2>
            {lanes}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center gap-2.5 text-stone-500">
            <span className="size-2.5 rounded-full bg-(--hire) animate-pulse motion-reduce:animate-none" />
            Searching Blast Hub
          </div>
        )}
      </div>
    </article>
  );
}

function Score({ value }: { value: number }) {
  const v = useCountUp(value);
  return <>{v.toFixed(1)}</>;
}

// A quiet disclosure; height eases open via grid rows so nothing jumps.
function Fold({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-1.5 py-2 text-left text-sm text-stone-500 hover:text-stone-800">
        <ChevronRight className={`size-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
        {label}
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">{open ? <div className="pt-1 pb-3">{children}</div> : null}</div>
      </div>
    </div>
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
    <div className={FEED_IN}>
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
        <Check className="size-4 text-emerald-600" strokeWidth={3} />
        Delivered by {result.agent_name}
      </h2>
      {isSite(out) ? (
        <SitePreview site={out} />
      ) : out ? (
        isEstimate(out as Estimate | Claim) ? (
          <EstimateTable e={out as Estimate} />
        ) : (
          <ClaimCodes c={out as Claim} />
        )
      ) : null}
      {result.reply ? (
        <Fold label="The specialist's full reply">
          <p className="text-[15px] leading-relaxed text-pretty whitespace-pre-line text-stone-800">{bold(result.reply)}</p>
        </Fold>
      ) : null}
    </div>
  );
}

function SitePreview({ site }: { site: Site }) {
  return (
    <div className="mt-3">
      <div className="overflow-hidden rounded-xl border border-stone-200 shadow-[0_12px_32px_-16px_rgb(70_50_30/0.3)]">
        <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-100 px-3 py-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-stone-300" />
            <span className="size-2.5 rounded-full bg-stone-300" />
            <span className="size-2.5 rounded-full bg-stone-300" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-center font-mono text-xs text-stone-500">{site.live_url || site.title}</span>
        </div>
        <div className="relative h-[440px] overflow-hidden bg-white">
          <iframe
            title={site.title}
            srcDoc={site.html}
            sandbox=""
            className="absolute top-0 left-0 h-[733px] w-[166.67%] origin-top-left scale-[0.6] border-0"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate font-medium text-stone-900">{site.title}</div>
        {site.live_url ? (
          <a href={site.live_url} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-(--hire) px-3.5 text-sm font-medium text-white hover:bg-(--hire)/90">
            Open live site <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      <Fold label="Palette and fonts">
      <div className="space-y-3 text-sm">
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
      </div>
      </Fold>
    </div>
  );
}

function History({ needs, focus, onPick }: { needs: LiveNeed[]; focus: string; onPick: (id: string) => void }) {
  return (
    <section className="mt-5">
      <h2 className="text-xs font-medium text-stone-500">Earlier hires</h2>
      <ul className={`${CARD} mt-1.5 divide-y divide-stone-100 overflow-hidden`}>
        {needs.map((n) => {
          const released = n.status === "waiting" || n.hold?.status === "released";
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onPick(n.id)}
                aria-pressed={n.id === focus}
                className={`grid w-full grid-cols-[3rem_7rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-left text-sm transition-colors duration-200 ease-out hover:bg-stone-50 ${n.id === focus ? "bg-(--hire-soft)" : ""}`}
              >
                <span className="text-xs text-stone-500 tabular-nums">{clock(n.created_at)}</span>
                <span className="truncate text-xs text-stone-500">{ROLE_LABEL[n.role] ?? n.role}</span>
                <span className="truncate text-stone-900">{n.text}</span>
                <span className={`text-xs tabular-nums ${released ? "text-stone-400" : "text-stone-600"}`}>
                  {released
                    ? "Released, nobody passed"
                    : `${n.result?.agent_name ?? (n.status === "auditioning" || n.status === "checkout" ? "In progress" : n.status === "hired" ? "Done" : n.status)}${n.hold?.status === "captured" ? ` · ${money(capturedCents(n.hold))}` : ""}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
