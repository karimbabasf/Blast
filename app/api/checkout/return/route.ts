import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase-admin";
import { verifyCheckout } from "@/lib/pay/stripe-market";

// Stripe sends the business back here after paying: verify, activate the engagement, open the console.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "session_id is required" }, { status: 400 });

  let paid;
  try {
    paid = await verifyCheckout(sessionId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "checkout not verified" }, { status: 402 });
  }
  if (!paid.engagement_id) return NextResponse.json({ error: "session has no engagement" }, { status: 400 });

  const db = admin();
  const { data: engagement, error } = await db
    .from("engagements")
    .update({
      status: "active",
      checkout_session_id: sessionId,
      subscription_id: paid.subscription_id,
      customer_id: paid.customer_id,
    })
    .eq("id", paid.engagement_id)
    .select("id, need_id")
    .single();
  if (error || !engagement) return NextResponse.json({ error: error?.message ?? "engagement not found" }, { status: 404 });
  await db.from("needs").update({ status: "hired" }).eq("id", engagement.need_id);

  return NextResponse.redirect(new URL(`/hired/${engagement.id}`, url.origin), 303);
}
