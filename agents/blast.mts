// Blast from the terminal: hire a specialist agent for a job. Pays over MPP from a Stripe test card;
// Blast holds the money and captures it only if the winner passes every check.
// Run: set -a; . ./.env.local; set +a; node agents/blast.mts "<job>" [base_url]
import { Challenge, Receipt } from "mppx";
import { Mppx, stripe } from "mppx/client";

const job = process.argv[2];
const base = process.argv[3] ?? "https://blast-kbkotes-projects.vercel.app";
const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!job) throw new Error('usage: node agents/blast.mts "<job>" [base_url]');
if (!key.startsWith("sk_test_")) throw new Error("needs a Stripe sandbox key (sk_test_) to mint a test card token");

const headers = new Headers({ "content-type": "application/json" });
const init = { method: "POST", headers, body: JSON.stringify({ job }) };
const unpaid = await fetch(`${base}/api/agent/hire`, init);
const challenge = Challenge.fromResponse(unpaid);
console.log(`${unpaid.status} Payment Required: ${challenge.description}, hold $${(Number(challenge.request.amount) / 100).toFixed(2)} via ${challenge.method}`);

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
        console.log(`paying with Shared Payment Token ${token.id} (cap $${(Number(amount) / 100).toFixed(2)})`);
        return token.id;
      },
    }),
  ],
});

console.log("specialists are trying out now (about a minute)...");
const paid = await mppx.fetch(`${base}/api/agent/hire`, init);
const body = await paid.json();
if (!paid.ok) throw new Error(`${paid.status}: ${JSON.stringify(body)}`);
console.log(`receipt ${Receipt.fromResponse(paid).reference}`);
console.log(JSON.stringify(body, null, 2));
