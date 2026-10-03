"use client";

import { Bot, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "./db";
import { clock, money } from "./format";
import { capturedCents, type LiveNeed, stripeLinks, workLine } from "./proof";

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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My hires</h1>
      <p className="mt-1 text-sm text-muted-foreground">Specialists Claude Code hired for you over MCP, with the work and the payment.</p>

      {!data ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading
        </div>
      ) : !data.needs.length ? (
        <p className="mt-8 text-muted-foreground">No hires yet. Ask Claude Code to hire a specialist.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-card">
          {data.needs.map((n) => (
            <HireRow key={n.id} need={n} builder={data.builders[n.result?.agent_id ?? n.hold?.agent_id ?? ""]} />
          ))}
        </ul>
      )}
    </main>
  );
}

function HireRow({ need: n, builder }: { need: Row; builder?: string }) {
  const h = n.hold;
  const work = workLine(n.result?.output);
  const day = new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <li className="relative grid gap-x-6 gap-y-2 p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,16rem)]">
      <div className="text-sm text-muted-foreground tabular-nums">
        <div>{clock(n.created_at)}</div>
        <div className="text-xs">{day}</div>
      </div>

      <div className="min-w-0">
        <Link href={`/?need=${n.id}`} className="line-clamp-2 font-medium after:absolute after:inset-0">
          {n.text}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className={`rounded-full px-2 py-0.5 text-xs ${n.status === "hired" ? "bg-success/15 text-success" : n.status === "waiting" ? "bg-muted text-muted-foreground" : "bg-(--hire-soft) text-(--hire)"}`}>
            {STATUS[n.status] ?? n.status}
          </span>
          {n.result?.agent_name ? (
            <span className="inline-flex items-center gap-1">
              <Bot className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{n.result.agent_name}</span>
              {builder ? <span className="text-muted-foreground">by {builder}</span> : null}
            </span>
          ) : null}
        </div>
        {work ? <p className="mt-1 truncate text-sm text-muted-foreground">{work}</p> : null}
      </div>

      <div className="text-sm tabular-nums sm:text-right">
        {!h?.payment_intent ? (
          <span className="text-muted-foreground">No payment yet</span>
        ) : (
          <>
            <div className="font-medium">
              {h.status === "captured"
                ? `${money(capturedCents(h))} captured of ${money(h.amount_cents)} held`
                : h.status === "released"
                  ? `${money(h.amount_cents)} released, nothing charged`
                  : `${money(h.amount_cents)} held`}
            </div>
            <div className="relative z-10 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:justify-end">
              <StripeLink href={stripeLinks.payment(h.payment_intent)}>{h.payment_intent}</StripeLink>
              {h.transfer ? <StripeLink href={stripeLinks.transfer(h.transfer)}>{h.transfer}</StripeLink> : null}
            </div>
            {h.via === "mpp" ? <div className="mt-1 text-xs text-muted-foreground">Paid over MPP</div> : null}
          </>
        )}
      </div>
    </li>
  );
}

function StripeLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 font-mono text-(--hire) hover:underline">
      <span className="truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}
