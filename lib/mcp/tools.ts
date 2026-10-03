import { Receipt } from "mppx";
import { Mppx, stripe } from "mppx/client";
import type { Check, MarketAgent } from "@/lib/market/types";
import { AGENT_COLUMNS } from "@/lib/runtime/catalog";
import { siteUrl } from "@/lib/runtime/hire";
import { mapRole } from "@/lib/runtime/route-role";
import { admin } from "@/lib/supabase-admin";

// What the MCP tools do. Hiring goes over real HTTP to Blast's paid endpoint, so the calling agent pays
// exactly like any outside agent would: a 402, then a Stripe Shared Payment Token.

export class ToolError extends Error {}

const SPT_URL = "https://api.stripe.com/v1/test_helpers/shared_payment/granted_tokens";

// The user's standing approval, set with the button on Blast's My hires page.
export async function spendingPolicy() {
  const { data } = await admin().from("spend_policy").select("auto_approve_cents").eq("id", 1).maybeSingle();
  const cents = Number(data?.auto_approve_cents ?? 0);
  return cents > 0
    ? {
        auto_approve_up_to_usd: cents / 100,
        note: `The user turned on "Let my agents hire without asking" on Blast, up to $${cents / 100} per job. A hire holds $1.00 and charges only the winner's price (cents), so it is within this standing approval: call hire_specialist now without asking.`,
      }
    : { auto_approve_up_to_usd: 0, note: "The user has not pre-approved hires. Ask before calling hire_specialist." };
}

export async function findSpecialists(job: string) {
  const role = await mapRole(job);
  const db = admin();
  const { data } = await db.from("market_agents").select(AGENT_COLUMNS).eq("role", role);
  const agents = (data ?? []) as MarketAgent[];
  const { data: rows } = await db
    .from("tryouts")
    .select("agent_id, score, checks")
    .in("agent_id", agents.map((a) => a.id));
  const record = (id: string) => {
    const mine = ((rows ?? []) as { agent_id: string; score: number | null; checks: Check[] }[]).filter((r) => r.agent_id === id);
    const scored = mine.filter((r) => r.score !== null);
    return {
      tryouts: mine.length,
      avg_score: scored.length ? Number((scored.reduce((a, r) => a + Number(r.score), 0) / scored.length).toFixed(1)) : null,
      passed_every_check: mine.filter((r) => r.checks?.length && r.checks.every((c) => c.passed)).length,
    };
  };
  return {
    role,
    specialists: agents.map((a) => ({
      name: a.name,
      builder: a.builder,
      model: a.model,
      tools: a.tools,
      price_per_job_usd: a.price_action_cents / 100,
      description: a.description,
      ...record(a.id),
    })),
    how_to_hire: "Call hire_specialist with the full job. Blast holds $1.00 and captures only the winner's price, only if it passes every check.",
    spending_policy: await spendingPolicy(),
  };
}

// The calling agent's wallet: a Shared Payment Token on a Stripe test card, capped at the hold.
export async function hireSpecialist(job: string) {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) throw new ToolError("Blast pays in the Stripe sandbox only");
  const headers = new Headers({ "content-type": "application/json" });
  const mppx = Mppx.create({
    polyfill: false,
    methods: [
      stripe.charge({
        paymentMethod: "pm_card_visa",
        createToken: async ({ paymentMethod, amount, currency, expiresAt }) => {
          const res = await fetch(SPT_URL, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "stripe-version": "2026-07-29.preview" },
            body: new URLSearchParams({
              payment_method: paymentMethod ?? "pm_card_visa",
              "usage_limits[currency]": currency,
              "usage_limits[max_amount]": amount,
              "usage_limits[expires_at]": String(expiresAt),
            }),
          });
          const token = (await res.json()) as { id?: string; error?: { message?: string } };
          if (!res.ok || !token.id) throw new ToolError(`Stripe token failed: ${token.error?.message ?? res.status}`);
          return token.id;
        },
      }),
    ],
  });
  const paid = await mppx.fetch(`${siteUrl()}/api/agent/hire`, { method: "POST", headers, body: JSON.stringify({ job }) });
  const body = await paid.json().catch(() => null);
  if (!paid.ok) throw new ToolError(String(body?.error ?? `hire failed with ${paid.status}`).slice(0, 200));
  return { ...body, stripe_receipt: Receipt.fromResponse(paid).reference };
}

export async function getHire(needId: string) {
  const db = admin();
  const { data: need } = await db.from("needs").select("*").eq("id", needId).maybeSingle();
  if (!need) throw new ToolError("hire not found");
  const { data: tryouts } = await db.from("tryouts").select("agent_id, status, score, checks, usage").eq("need_id", needId);
  return { ...need, live_url: `${siteUrl()}/?need=${needId}`, tryouts };
}
