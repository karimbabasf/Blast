import { Challenge, Receipt } from "mppx";
import { Mppx, stripe } from "mppx/client";

export function blastUrl() {
  return process.env.BLAST_URL ?? "https://blast-kbkotes-projects.vercel.app";
}

// Sandbox only: the buyer mints a Shared Payment Token on a Stripe test card, as agents/demo-agent.mts does.
function sandboxKey() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) throw new Error("needs a Stripe sandbox key (sk_test_) to mint a test card token");
  return key;
}

function payer() {
  const key = sandboxKey();
  return Mppx.create({
    polyfill: false,
    methods: [
      stripe.charge({
        paymentMethod: "pm_card_visa",
        createToken: async ({ paymentMethod, amount, currency, expiresAt }) => {
          const res = await fetch("https://api.stripe.com/v1/test_helpers/shared_payment/granted_tokens", {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "stripe-version": "2026-07-29.preview" },
            body: new URLSearchParams({
              payment_method: paymentMethod ?? "pm_card_visa",
              "usage_limits[currency]": currency,
              "usage_limits[max_amount]": amount,
              "usage_limits[expires_at]": String(expiresAt),
            }),
          });
          const token = await res.json();
          if (!res.ok) throw new Error(`SPT failed: ${token.error?.message}`);
          return token.id;
        },
      }),
    ],
  });
}

function hireRequest(goal: string) {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal }) };
}

// An unpaid hire request returns the 402 MPP challenge, which is Blast's price quote. Nothing is charged.
export async function quote(goal = "Make me a 15 second radio ad.") {
  const unpaid = await fetch(`${blastUrl()}/api/agent/hire`, hireRequest(goal));
  if (unpaid.status !== 402) throw new Error(`expected a 402 payment challenge, got ${unpaid.status}`);
  const challenge = Challenge.fromResponse(unpaid);
  return {
    status: unpaid.status,
    method: challenge.method,
    description: challenge.description,
    price: `$${(Number(challenge.request.amount) / 100).toFixed(2)} ${String(challenge.request.currency).toUpperCase()}`,
  };
}

export async function buyAd(goal: string, agreedPrice: string) {
  const challenge = await quote(goal);
  if (challenge.price !== agreedPrice) {
    throw new Error(`Blast asks ${challenge.price}, not the agreed ${agreedPrice}. Not paying.`);
  }
  const paid = await payer().fetch(`${blastUrl()}/api/agent/hire`, hireRequest(goal));
  const body = await paid.json();
  if (!paid.ok) throw new Error(`hire ${paid.status}: ${JSON.stringify(body)}`);

  return {
    challenge,
    script: body.script,
    audio_url: body.audio_url,
    winners: body.winners,
    receipt: {
      paid_status: paid.status,
      paid_cents: body.paid_cents,
      payouts_cents: body.payouts_cents,
      margin_cents: body.margin_cents,
      stripe_payment: body.stripe_payment,
      mpp_receipt: Receipt.fromResponse(paid).reference,
    },
  };
}
