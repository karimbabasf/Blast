import { admin } from "@/lib/supabase-admin";

const AGENT_COLUMNS =
  "id, name, builder, role, description, model, tools, price_month_cents, price_action_cents, runs_in, auditionable, stripe_account";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = admin();
  const { data: need } = await db.from("needs").select("*").eq("id", id).maybeSingle();
  if (!need) return Response.json({ error: "need not found" }, { status: 404 });

  const [{ data: tryouts }, { data: agents }] = await Promise.all([
    db.from("tryouts").select("*, steps_log:tryout_steps(*)").eq("need_id", id).order("created_at"),
    db.from("market_agents").select(AGENT_COLUMNS).eq("role", need.role),
  ]);
  const withSteps = (tryouts ?? []).map(({ steps_log, ...t }) => ({
    ...t,
    score: t.score === null ? null : Number(t.score),
    step_list: ((steps_log ?? []) as { n: number }[]).sort((a, b) => a.n - b.n),
  }));
  return Response.json({ need, tryouts: withSteps, agents: agents ?? [] });
}
