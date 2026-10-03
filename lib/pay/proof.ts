import crypto from "crypto";
import StripeClient from "stripe";
import { Mppx, Store, stripe } from "mppx/server";

// Pay on proof. The buyer agent pays over MPP (HTTP 402, Stripe Shared Payment Token), but the payment
// is only a hold. Blast captures the winner's price after its work passed the checks, pays the builder
// through Connect, and releases everything when no specialist passed. Sandbox only.

export const HOLD_CENTS = 4000;
const BUILDER_SHARE = 0.8;

function testKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY is not a test key, refusing to take payments");
  }
  return key;
}

// mppx confirms the PaymentIntent itself. This client asks Stripe to authorize only, and tells mppx the
// authorized hold counts as paid.
function holdingClient(key: string) {
  const client = new StripeClient(key);
  const create = client.paymentIntents.create.bind(client.paymentIntents);
  client.paymentIntents.create = (async (params: StripeClient.PaymentIntentCreateParams, options?: StripeClient.RequestOptions) => {
    const pi = await create({ ...params, capture_method: "manual" }, options);
    return pi.status === "requires_capture" ? Object.assign(pi, { status: "succeeded" as const }) : pi;
  }) as typeof client.paymentIntents.create;
  return client;
}

let instance: ReturnType<typeof create> | null = null;

function create() {
  const key = testKey();
  return Mppx.create({
    methods: stripe
      .create({
        client: holdingClient(key),
        networkId: process.env.STRIPE_PROFILE_ID || "blast-sandbox",
        livemode: false,
        store: Store.memory(),
      })
      .defaultMethods(),
    secretKey: crypto.createHmac("sha256", key).update("mpp-proof-signing").digest("base64"),
  });
}

export function proofMpp() {
  instance ??= create();
  return instance;
}

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

// Capture the winner's price and pay its builder, or release the hold.
export async function settle(hold: Hold, winner: { id: string; price_cents: number; stripe_account: string | null } | null): Promise<Hold> {
  const s = new StripeClient(testKey());
  if (!winner) {
    await s.paymentIntents.cancel(hold.payment_intent).catch(() => null);
    return { ...hold, status: "released" };
  }
  const amount = Math.min(winner.price_cents, hold.amount_cents);
  const pi = await s.paymentIntents.capture(hold.payment_intent, { amount_to_capture: amount, expand: ["latest_charge"] });
  const charge = pi.latest_charge;
  const chargeId = typeof charge === "string" ? charge : charge?.id;
  const builder = Math.round(amount * BUILDER_SHARE);
  let transfer: string | undefined;
  if (winner.stripe_account && chargeId) {
    const t = await s.transfers
      .create({
        amount: builder,
        currency: "usd",
        destination: winner.stripe_account,
        source_transaction: chargeId,
        description: `Blast: ${winner.id} passed its checks`,
      })
      .catch(() => null);
    transfer = t?.id;
  }
  return {
    ...hold,
    status: "captured",
    captured_cents: amount,
    transfer,
    builder_cents: transfer ? builder : 0,
    blast_cents: transfer ? amount - builder : amount,
    agent_id: winner.id,
  };
}
