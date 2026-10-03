import type { Need, Tryout } from "@/lib/market/types";
import { money } from "./format";

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

export function capturedCents(h: Hold) {
  return h.captured_cents ?? (h.builder_cents != null || h.blast_cents != null ? (h.builder_cents ?? 0) + (h.blast_cents ?? 0) : h.amount_cents);
}

export const stripeLinks = {
  payment: (pi: string) => `${STRIPE}/payments/${pi}`,
  transfer: (tr: string) => `${STRIPE}/connect/transfers/${tr}`,
};

export function isEstimate(o: Estimate | Claim): o is Estimate {
  return "parts" in o || "total_cents" in o;
}

export function EstimateTable({ e }: { e: Estimate }) {
  return (
    <div className="mt-5">
      <p className="text-base">
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
          <tr className="text-base font-semibold">
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
