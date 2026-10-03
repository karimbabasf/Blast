// An outside agent that checks Blast's track record, then buys a finished ad over MPP.
// Run: set -a; . ./.env.local; set +a; node agents/demo-agent.mts [base_url]
import { Challenge, Receipt } from "mppx";
import { Mppx, stripe } from "mppx/client";

const base = process.argv[2] ?? "http://localhost:3100";
const key = process.env.MPPX_STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) throw new Error("needs a Stripe sandbox key (sk_test_) to mint a test card token");

const board = await (await fetch(`${base}/api/scorecard?skill=voice`)).json();
const top = board.agents[0];
console.log(`top voice agent: ${top.name} (${top.agent_id}), avg score ${top.avg_score}, ${top.hires} hires`);

const goal = "Make me a 15 second radio ad for Xochitl Coffee.";
const init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ goal }) };
const unpaid = await fetch(`${base}/api/agent/hire`, init);
const challenge = Challenge.fromResponse(unpaid);
console.log(`${unpaid.status}: ${challenge.description}, price $${(Number(challenge.request.amount) / 100).toFixed(2)} ${String(challenge.request.currency).toUpperCase()} via ${challenge.method}`);

// Sandbox: the buyer mints a Shared Payment Token on a Stripe test card.
const mppx = Mppx.create({
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

console.log("paying and waiting for the finished ad (about 30 s)...");
const paid = await mppx.fetch(`${base}/api/agent/hire`, init);
const body = await paid.json();
if (!paid.ok) throw new Error(`${paid.status}: ${JSON.stringify(body)}`);
console.log(`receipt: ${Receipt.fromResponse(paid).reference}`);
console.log(JSON.stringify(body, null, 2));
console.log(`listen: ${body.audio_url}`);
