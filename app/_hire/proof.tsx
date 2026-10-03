import { Bot, Check, ExternalLink, Lock, RotateCcw } from "lucide-react";
import type { Need, Tryout } from "@/lib/market/types";
import { money } from "./format";
import { SpeakButton } from "./voice";

const STRIPE = "https://dashboard.stripe.com/test";

// Columns the lead adds to needs. All three are absent on old rows.
export type Hold = {
  status: "held" | "captured" | "released";
  payment_intent: string;
  amount_cents: number;
  via: "mpp" | "card";
  spt?: string;
  captured_cents?: number;
  transfer?: string;
  builder_cents?: number;
  blast_cents?: number;
  agent_id?: string;
};

export type Estimate = {
  diagnosis: string;
  tsb?: string;
  parts: { part_number: string; name: string; price_cents: number }[];
  labor_hours: number;
  labor_cents: number;
  total_cents: number;
};

export type Claim = { payer: string; icd10: string[]; cpt: { code: string; modifiers?: string[] }[] };

export type Result = { agent_id: string; agent_name: string; reply: string; summary?: string; output: Estimate | Claim | null };

export type Usage = { input_tokens?: number; output_tokens?: number; cost_usd?: number };

export type LiveTryout = Tryout & { usage?: Usage | null };

export type Search = {
  listings: number;
  query: string;
  matches: { id: string; name: string; builder: string; role: string; similarity: number }[];
};

export type LiveNeed = Need & { source?: string | null; hold?: Hold | null; result?: Result | null; search?: Search | null };

export function SearchBlock({ search, auditioned }: { search: Search | null | undefined; auditioned: Set<string> }) {
  if (!search?.matches?.length) return null;
  return (
    <section className="rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">Found by Semantic Search</h3>
        <p className="text-sm text-muted-foreground tabular-nums">pgvector over {search.listings} Hub listings</p>
      </div>
      {search.query ? <p className="mt-1 text-sm text-muted-foreground">&ldquo;{search.query}&rdquo;</p> : null}
      <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-2 text-sm">
        {search.matches.map((m) => {
          const tried = auditioned.has(m.id);
          return (
            <li key={m.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${tried ? "bg-(--hire-soft)" : "bg-muted"}`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.builder}
                  {tried ? <span className="font-medium text-(--hire)"> · tried out</span> : null}
                </span>
              </span>
              <span className="shrink-0 text-base font-semibold tabular-nums">{Math.round(m.similarity * 100)}%</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function capturedCents(h: Hold) {
  return h.captured_cents ?? (h.builder_cents != null || h.blast_cents != null ? (h.builder_cents ?? 0) + (h.blast_cents ?? 0) : h.amount_cents);
}

// One line of the work: "Estimate $214.40: misfire, cyl 1 coil" or "I10 R51.9 / 99213-25".
export function workLine(out: Estimate | Claim | null | undefined) {
  if (!out) return "";
  if (isEstimate(out)) return [out.total_cents != null ? `Estimate ${money(out.total_cents)}` : "", out.diagnosis].filter(Boolean).join(": ");
  const cpt = (out.cpt ?? []).map((c) => [c.code, ...(c.modifiers ?? [])].join("-")).join(" ");
  return [(out.icd10 ?? []).join(" "), cpt].filter(Boolean).join(" / ");
}

export const stripeLinks = {
  payment: (pi: string) => `${STRIPE}/payments/${pi}`,
  transfer: (tr: string) => `${STRIPE}/connect/transfers/${tr}`,
};

function Id({ href, children }: { href?: string; children: string }) {
  const cls = "font-mono text-[0.85em] break-all";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} inline-flex items-center gap-1 text-(--hire) hover:underline`}>
      {children}
      <ExternalLink className="size-3.5 shrink-0" />
    </a>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function SourceBadge({ need }: { need: LiveNeed | null }) {
  if (need?.source !== "claude-code") return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-(--hire)/40 bg-(--hire-soft) px-3.5 py-1.5 text-sm font-medium text-(--hire)">
      <Bot className="size-4" /> Hired by Claude Code over MCP
    </div>
  );
}

export function HoldStrip({ hold }: { hold: Hold | null | undefined }) {
  if (!hold?.payment_intent) return null;
  const pi = <Id href={`${STRIPE}/payments/${hold.payment_intent}`}>{hold.payment_intent}</Id>;
  const tone =
    hold.status === "captured"
      ? "border-success/40 bg-success/10"
      : hold.status === "released"
        ? "border-border bg-muted/60"
        : "border-(--hire)/40 bg-(--hire-soft)";
  const Icon = hold.status === "captured" ? Check : hold.status === "released" ? RotateCcw : Lock;
  return (
    <div className={`rounded-3xl border px-5 py-4 text-base ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon className="size-5 shrink-0" />
        <span className="font-semibold tabular-nums">Held {money(hold.amount_cents)} on Stripe</span>
        <span className="text-base">({pi})</span>
      </div>
      {hold.status === "captured" ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
          <span className="font-semibold">Captured:</span> proof passed, builder paid{" "}
          {hold.builder_cents != null ? money(hold.builder_cents) : ""}
          {hold.transfer ? (
            <span className="text-base">
              (<Id href={`${STRIPE}/connect/transfers/${hold.transfer}`}>{hold.transfer}</Id>)
            </span>
          ) : null}
          {hold.blast_cents != null ? <span>, Blast kept {money(hold.blast_cents)}</span> : null}
        </p>
      ) : hold.status === "released" ? (
        <p className="mt-2">
          <span className="font-semibold">Released:</span> no specialist passed, nothing charged
        </p>
      ) : (
        <p className="mt-2 text-base text-muted-foreground">Captured only if the winner passes its checks.</p>
      )}
      {hold.via === "mpp" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Paid by Claude Code over MPP (HTTP 402, Stripe Shared Payment Token){hold.spt ? <>: <Id>{hold.spt}</Id></> : null}
        </p>
      ) : null}
    </div>
  );
}

export function isEstimate(o: Estimate | Claim): o is Estimate {
  return "parts" in o || "total_cents" in o;
}

export function ResultCard({ result }: { result: Result | null | undefined }) {
  if (!result) return null;
  const out = result.output;
  return (
    <section className="rounded-3xl bg-card p-5 ring-2 ring-(--hire)">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">The work, from the winner</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">{result.agent_name}</h3>
        </div>
        {result.reply ? <SpeakButton text={result.reply} /> : null}
      </div>
      {result.reply ? <p className="mt-3 max-w-3xl text-lg leading-relaxed whitespace-pre-line">{result.reply.replace(/\*\*|`|^#+\s*/gm, "")}</p> : null}
      {out ? isEstimate(out) ? <EstimateTable e={out} /> : "icd10" in out ? <ClaimCodes c={out} /> : null : null}
    </section>
  );
}

export function EstimateTable({ e }: { e: Estimate }) {
  return (
    <div className="mt-5">
      <p className="text-lg">
        <span className="font-semibold">Diagnosis:</span> {e.diagnosis}
        {e.tsb ? <span className="ml-2 rounded-full bg-(--hire-soft) px-2.5 py-0.5 text-sm text-(--hire)">TSB {e.tsb.replace(/^TSB\s*/i, "")}</span> : null}
      </p>
      <table className="mt-4 w-full max-w-3xl text-base tabular-nums">
        <thead className="text-left text-sm text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-4 font-normal">Part</th>
            <th className="py-2 pr-4 font-normal">Number</th>
            <th className="py-2 text-right font-normal">Price</th>
          </tr>
        </thead>
        <tbody>
          {(e.parts ?? []).map((p) => (
            <tr key={p.part_number + p.name} className="border-b">
              <td className="py-2 pr-4">{p.name}</td>
              <td className="py-2 pr-4 font-mono text-sm">{p.part_number}</td>
              <td className="py-2 text-right">{money(p.price_cents)}</td>
            </tr>
          ))}
          <tr className="border-b">
            <td className="py-2 pr-4">Labor</td>
            <td className="py-2 pr-4 text-sm text-muted-foreground">{e.labor_hours} h</td>
            <td className="py-2 text-right">{money(e.labor_cents)}</td>
          </tr>
          <tr className="text-lg font-semibold">
            <td className="pt-3 pr-4" colSpan={2}>
              Total
            </td>
            <td className="pt-3 text-right">{money(e.total_cents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ClaimCodes({ c }: { c: Claim }) {
  return (
    <dl className="mt-5 grid max-w-3xl grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-6 gap-y-3 text-base">
      <dt className="text-sm text-muted-foreground">Payer</dt>
      <dd className="font-medium">{c.payer}</dd>
      <dt className="text-sm text-muted-foreground">ICD-10</dt>
      <dd className="flex flex-wrap gap-1.5">
        {(c.icd10 ?? []).map((code) => (
          <span key={code} className="rounded-full bg-(--hire-soft) px-3 py-1 font-mono text-sm text-(--hire)">
            {code}
          </span>
        ))}
      </dd>
      <dt className="text-sm text-muted-foreground">CPT</dt>
      <dd className="flex flex-wrap gap-1.5">
        {(c.cpt ?? []).map((p) => (
          <span key={p.code + (p.modifiers ?? []).join()} className="rounded-full border px-3 py-1 font-mono text-sm">
            {p.code}
            {p.modifiers?.length ? <span className="text-muted-foreground">-{p.modifiers.join("-")}</span> : null}
          </span>
        ))}
      </dd>
    </dl>
  );
}
