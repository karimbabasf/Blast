// Stripe for the marketplace: Connect accounts for builders, Checkout for a hire, a Billing Meter per action.
// Sandbox only: every call refuses a key that is not sk_test_.

import Stripe from "stripe";
import { admin } from "@/lib/supabase-admin";
import type { Engagement, MarketAgent } from "@/lib/market/types";

const METER_EVENT = "agent_action";
const PLATFORM_FEE_PERCENT = 20;

let client: Stripe | null = null;

function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("STRIPE_SECRET_KEY is not a sandbox sk_test_ key, refusing");
  client = new Stripe(key);
  return client;
}

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
}

async function cached(key: string, make: () => Promise<string>): Promise<string> {
  const db = admin();
  const { data } = await db.from("stripe_setup").select("value").eq("key", key).maybeSingle();
  if (data?.value) return data.value;
  const value = await make();
  await db.from("stripe_setup").upsert({ key, value });
  return value;
}

export type MarketSetup = { meter_id: string; action_product_id: string };

// One-time and idempotent: the agent_action meter and the product its metered prices hang off.
export async function ensureMarketSetup(): Promise<MarketSetup> {
  const s = stripe();
  const meter_id = await cached("meter_id", async () => {
    const meters = await s.billing.meters.list({ status: "active", limit: 100 });
    const found = meters.data.find((m) => m.event_name === METER_EVENT);
    if (found) return found.id;
    const meter = await s.billing.meters.create({
      display_name: "Agent actions",
      event_name: METER_EVENT,
      default_aggregation: { formula: "sum" },
      customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" },
      value_settings: { event_payload_key: "value" },
    });
    return meter.id;
  });
  const action_product_id = await cached("action_product_id", async () => {
    const product = await s.products.create({ name: "Agent action", metadata: { blast: "agent_action" } });
    return product.id;
  });
  return { meter_id, action_product_id };
}

// Metered prices cannot be inline price_data, so each per-action price is a real Price, found by lookup key.
async function actionPrice(cents: number): Promise<string> {
  const s = stripe();
  const lookup_key = `agent_action_${cents}c`;
  const existing = await s.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const { meter_id, action_product_id } = await ensureMarketSetup();
  const price = await s.prices.create({
    product: action_product_id,
    currency: "usd",
    unit_amount: cents,
    lookup_key,
    nickname: `Agent action, ${cents} cents`,
    recurring: { interval: "month", usage_type: "metered", meter: meter_id },
  });
  return price.id;
}

// One Connect account per builder (Accounts v2; v1 creation is off for this platform).
// First choice: platform-owned onboarding with Stripe's test identity prefilled and terms attested,
// so transfers and card payments activate with no human step. Stripe allows that only after the
// platform accepts loss liability in its Connect platform profile; until then the builder gets a
// Stripe-owned account and an onboarding link.
export async function ensureBuilderAccount(
  builder: string,
  email: string,
): Promise<{ stripe_account: string | null; onboarding_url: string | null }> {
  if (builder.trim().toLowerCase() === "blast") return { stripe_account: null, onboarding_url: null };
  const db = admin();
  const { data: row } = await db.from("builder_accounts").select("stripe_account").eq("builder", builder).maybeSingle();
  if (row?.stripe_account) {
    const ready = await transfersActive(row.stripe_account);
    return { stripe_account: row.stripe_account, onboarding_url: ready ? null : await onboardingLink(row.stripe_account) };
  }

  const s = stripe();
  const [first, ...rest] = builder.trim().split(/\s+/);
  const base = {
    contact_email: email,
    display_name: builder,
    configuration: {
      merchant: {
        mcc: "5734",
        statement_descriptor: { descriptor: "BLAST AGENTS" },
        support: { phone: "0000000000" },
        capabilities: { card_payments: { requested: true } },
      },
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
    },
    include: ["configuration.recipient" as const],
  };
  const profile = { business_url: "https://accessible.stripe.com", product_description: "AI agents" };
  const individual = {
    given_name: first || "Builder",
    surname: rest.join(" ") || "Builder",
    email,
    phone: "0000000000",
    date_of_birth: { day: 1, month: 1, year: 1901 },
    address: { line1: "address_full_match", city: "San Francisco", state: "CA", postal_code: "94103", country: "us" },
    id_numbers: [{ type: "us_ssn" as const, value: "000000000" }],
  };

  let accountId: string;
  try {
    const account = await s.v2.core.accounts.create({
      ...base,
      dashboard: "none",
      defaults: { profile, responsibilities: { fees_collector: "application", losses_collector: "application" } },
      identity: {
        country: "us",
        entity_type: "individual",
        individual,
        attestations: { terms_of_service: { account: { date: new Date().toISOString(), ip: "127.0.0.1" } } },
      },
    });
    accountId = account.id;
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("platform-profile")) throw e;
    const account = await s.v2.core.accounts.create({
      ...base,
      dashboard: "full",
      defaults: { profile, responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
      identity: { country: "us", entity_type: "individual", individual },
    });
    accountId = account.id;
  }
  await db.from("builder_accounts").upsert({ builder, email, stripe_account: accountId }, { onConflict: "builder" });
  const ready = await transfersActive(accountId);
  return { stripe_account: accountId, onboarding_url: ready ? null : await onboardingLink(accountId) };
}

async function transfersActive(accountId: string): Promise<boolean> {
  const account = await stripe().v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
  return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
}

async function onboardingLink(accountId: string): Promise<string> {
  const link = await stripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: `${appOrigin()}/post`,
        return_url: `${appOrigin()}/post`,
      },
    },
  });
  return link.url;
}

type CheckoutAgent = Pick<MarketAgent, "id" | "name" | "builder" | "price_month_cents" | "price_action_cents" | "stripe_account">;

// Subscription Checkout: the agent's monthly price plus its metered per-action price.
// Builder agents route the money to their Connect account; Blast keeps 20 percent.
export async function createCheckout(
  engagement: Pick<Engagement, "id" | "need_id">,
  agent: CheckoutAgent,
  customerEmail: string | null,
  origin: string = appOrigin(),
): Promise<{ id: string; url: string; payout: "connect" | "pending" | "blast" }> {
  const s = stripe();
  const metered = await actionPrice(agent.price_action_cents);
  const metadata = { engagement_id: engagement.id, need_id: engagement.need_id, agent_id: agent.id };
  // A builder whose account cannot take transfers yet still gets hired; the payout is marked pending.
  const payout = agent.builder.trim().toLowerCase() === "blast" ? "blast"
    : agent.stripe_account && (await transfersActive(agent.stripe_account)) ? "connect" : "pending";
  const session = await s.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: customerEmail ?? undefined,
      client_reference_id: engagement.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: agent.price_month_cents,
            recurring: { interval: "month" },
            product_data: { name: `${agent.name} by ${agent.builder}`, metadata: { agent_id: agent.id } },
          },
        },
        { price: metered },
      ],
      subscription_data: {
        metadata,
        ...(payout === "connect"
          ? { transfer_data: { destination: agent.stripe_account as string }, application_fee_percent: PLATFORM_FEE_PERCENT }
          : {}),
      },
      metadata: { ...metadata, payout },
      success_url: `${origin}/api/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    },
    { idempotencyKey: `checkout:${engagement.id}` },
  );
  if (!session.url) throw new Error("Stripe returned a Checkout Session without a url");
  return { id: session.id, url: session.url, payout };
}

export type VerifiedCheckout = {
  engagement_id: string | null;
  subscription_id: string;
  customer_id: string;
  status: string;
};

// Paid means the session completed and its subscription is live.
export async function verifyCheckout(sessionId: string): Promise<VerifiedCheckout> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.status !== "complete") throw new Error(`Checkout is ${session.status}, not complete`);
  const sub = session.subscription;
  if (!sub || typeof sub === "string") throw new Error("Checkout has no subscription");
  if (sub.status !== "active" && sub.status !== "trialing") throw new Error(`Subscription is ${sub.status}`);
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customer) throw new Error("Checkout has no customer");
  return {
    engagement_id: session.client_reference_id ?? session.metadata?.engagement_id ?? null,
    subscription_id: sub.id,
    customer_id: customer,
    status: sub.status,
  };
}

// One action by a hired agent: one meter event for its customer, and engagements.actions + 1.
export async function meterAction(engagementId: string): Promise<{ actions: number; meter_event: string }> {
  const db = admin();
  const { data: eng, error } = await db
    .from("engagements")
    .select("customer_id, status")
    .eq("id", engagementId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!eng?.customer_id) throw new Error("Engagement has no Stripe customer yet");
  const identifier = `${engagementId}:${crypto.randomUUID()}`;
  await stripe().billing.meterEvents.create({
    event_name: METER_EVENT,
    identifier,
    payload: { stripe_customer_id: eng.customer_id, value: "1" },
  });
  const { data: actions, error: rpcError } = await db.rpc("increment_engagement_actions", { eid: engagementId });
  if (rpcError) throw new Error(rpcError.message);
  return { actions: Number(actions), meter_event: identifier };
}
