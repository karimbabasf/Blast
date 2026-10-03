import { admin } from "@/lib/supabase-admin";
import { HOLD_CENTS } from "@/lib/pay/proof";

export const dynamic = "force-dynamic";

// GET the standing approval; POST { auto_approve: boolean } turns it on (up to one hold) or off.
export async function GET() {
  const { data } = await admin().from("spend_policy").select("auto_approve_cents, updated_at").eq("id", 1).maybeSingle();
  return Response.json(data ?? { auto_approve_cents: 0, updated_at: null });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { auto_approve?: unknown } | null;
  if (typeof body?.auto_approve !== "boolean") return Response.json({ error: "auto_approve must be true or false" }, { status: 400 });
  const { data, error } = await admin()
    .from("spend_policy")
    .upsert({ id: 1, auto_approve_cents: body.auto_approve ? HOLD_CENTS : 0, updated_at: new Date().toISOString() })
    .select("auto_approve_cents, updated_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
