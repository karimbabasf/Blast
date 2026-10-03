import { Challenge, Receipt } from "mppx";
import { Mppx, stripe } from "mppx/client";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Tone = "info" | "good" | "warn" | "bad";

// Plays the part of an outside agent, the same steps as agents/demo-agent.mts:
// check Blast's track record, ask for an ad, get an HTTP 402, pay over Stripe
// machine payments (sandbox), receive the finished ad. Each step is streamed
// back as one JSON line so the page can show it as it happens.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const goal =
    typeof body?.goal === "string" && body.goal.trim()
      ? body.goal.trim().slice(0, 200)
      : undefined;
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) {
    return Response.json(
      { error: "The outside agent needs a Stripe sandbox key (sk_test_)." },
      { status: 500 },
    );
  }

  const base = new URL(request.url).origin;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      const note = (id: string, text: string, tone: Tone = "info") =>
        send({ type: "note", id, text, tone });

      try {
        const board = await (await fetch(`${base}/api/scorecard?skill=voice`)).json();
        const top = board.agents?.[0];
        if (top) {
          note(
            "scorecard",
            `Outside agent checked the scorecard. Top voice agent: ${top.name}, average ${top.avg_score ?? "none yet"} over ${top.auditions} auditions`,
          );
        }

        const init = {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(goal ? { goal } : {}),
        };
        const unpaid = await fetch(`${base}/api/agent/hire`, init);
        const challenge = Challenge.fromResponse(unpaid);
        const price = (Number(challenge.request.amount) / 100).toFixed(2);
        note(
          "challenge",
          `Blast answered HTTP ${unpaid.status}: pay $${price} ${String(challenge.request.currency).toUpperCase()} over ${challenge.method} first`,
          "warn",
        );

        // Sandbox: the buyer mints a Shared Payment Token on a Stripe test card.
        const mppx = Mppx.create({
          polyfill: false,
          methods: [
            stripe.charge({
              paymentMethod: "pm_card_visa",
              createToken: async ({ paymentMethod, amount, currency, expiresAt }) => {
                const res = await fetch(
                  "https://api.stripe.com/v1/test_helpers/shared_payment/granted_tokens",
                  {
                    method: "POST",
                    headers: {
                      authorization: `Bearer ${key}`,
                      "stripe-version": "2026-07-29.preview",
                    },
                    body: new URLSearchParams({
                      payment_method: paymentMethod ?? "pm_card_visa",
                      "usage_limits[currency]": currency,
                      "usage_limits[max_amount]": amount,
                      "usage_limits[expires_at]": String(expiresAt),
                    }),
                  },
                );
                const token = await res.json();
                if (!res.ok) throw new Error(`payment token failed: ${token.error?.message}`);
                return token.id;
              },
            }),
          ],
        });

        note("paying", `Outside agent paid $${price} with a Stripe test card token`);
        const paid = await mppx.fetch(`${base}/api/agent/hire`, init);
        const result = await paid.json();
        if (!paid.ok) {
          throw new Error(
            `${result.error ?? paid.status}${result.refund ? ` (refunded: ${result.refund})` : ""}`,
          );
        }

        const receipt = Receipt.fromResponse(paid).reference;
        note("receipt", `Blast delivered the ad to the agent. Receipt ${receipt}`, "good");
        send({ type: "done", run_id: result.run_id, stripe_payment: receipt });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: message.slice(0, 200) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}
