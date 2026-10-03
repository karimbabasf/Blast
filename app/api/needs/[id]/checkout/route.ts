import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";
import { createCheckout } from "@/lib/pay/stripe-market";

// The demo business; the box on the page has no email field.
const DEMO_EMAIL = "owner@xochitl.coffee";

type Ctx = { params: Promise<{ id: string }> };

// Approve a winner: open a pending engagement and send the business to Stripe Checkout.
export async function POST(request: Request, ctx: Ctx) {
  const needId = (await ctx.params).id;
  const body = (await request.json().catch(() => ({}))) as { agent_id?: string; email?: string };
  if (!body.agent_id) return NextResponse.json({ error: "agent_id is required" }, { status: 400 });

  const db = admin();
  const { data: agent, error: agentError } = await db
    .from("market_agents")
    .select("id, name, builder, price_month_cents, price_action_cents, stripe_account")
    .eq("id", body.agent_id)
    .maybeSingle();
  if (agentError) return NextResponse.json({ error: agentError.message }, { status: 500 });
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });

  const { data: engagement, error } = await db
    .from("engagements")
    .insert({ need_id: needId, agent_id: agent.id, status: "pending_payment" })
    .select("id, need_id")
    .single();
  if (error || !engagement) return NextResponse.json({ error: error?.message ?? "engagement insert failed" }, { status: 500 });

  try {
    const session = await createCheckout(engagement, agent, body.email ?? DEMO_EMAIL, new URL(request.url).origin);
    await db.from("engagements").update({ checkout_session_id: session.id }).eq("id", engagement.id);
    await db.from("needs").update({ status: "checkout" }).eq("id", needId);
    return NextResponse.json({ url: session.url, engagement_id: engagement.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "checkout failed" }, { status: 502 });
  }
}
