// Pays a hired agent. Stripe test mode with a key, a simulated payment without one.

export type PayInput = {
  run_id: string;
  job_id: string;
  agent_id: string;
  amount_cents: number;
  description: string;
};

export type PayResult = { stripe_id: string; status: string };

export async function pay(input: PayInput): Promise<PayResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const id = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
    return { stripe_id: `pi_simulated_${id}`, status: "simulated" };
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY is not a test key, refusing to pay");
  }

  const form = new URLSearchParams({
    amount: String(input.amount_cents),
    currency: "usd",
    confirm: "true",
    payment_method: "pm_card_visa",
    "automatic_payment_methods[enabled]": "true",
    "automatic_payment_methods[allow_redirects]": "never",
    description: input.description,
    "metadata[run_id]": input.run_id,
    "metadata[job_id]": input.job_id,
    "metadata[agent_id]": input.agent_id,
  });
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": `${input.job_id}:${input.agent_id}`,
    },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${body?.error?.message ?? "payment failed"}`);
  }
  return { stripe_id: body.id, status: body.status };
}
