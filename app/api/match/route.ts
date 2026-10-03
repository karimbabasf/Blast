import type { Check, MarketAgent, Role } from "@/lib/market/types";
import { AGENT_COLUMNS } from "@/lib/runtime/catalog";
import { mapRole } from "@/lib/runtime/route-role";
import { admin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const HIREABLE: Partial<Record<Role, string>> = {
  web_design: "web design",
  auto_repair: "auto repair",
  medical_billing: "medical billing",
};

// GET /api/match?q=<task>: does Blast Hub have a proven specialist for this task? Used by the Claude Code hook.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ error: "q is required" }, { status: 400 });
  const role = await mapRole(q);
  const label = HIREABLE[role];
  if (!label) return Response.json({ role, best: null });

  const db = admin();
  const { data } = await db.from("market_agents").select(AGENT_COLUMNS).eq("role", role).eq("auditionable", true);
  const agents = ((data ?? []) as MarketAgent[]).filter((a) => a.price_action_cents > 0);
  const { data: rows } = await db.from("tryouts").select("agent_id, score, checks").in("agent_id", agents.map((a) => a.id));
  const tried = (rows ?? []) as { agent_id: string; score: number | null; checks: Check[] }[];
  const record = agents.map((a) => {
    const mine = tried.filter((r) => r.agent_id === a.id && r.score !== null);
    const perfect = mine.filter((r) => r.checks?.length && r.checks.every((c) => c.passed)).length;
    const avg = mine.length ? mine.reduce((s, r) => s + Number(r.score), 0) / mine.length : 0;
    return { agent: a, tryouts: mine.length, perfect, avg: Math.round(avg * 10) / 10, checks: mine[0]?.checks?.length ?? 0 };
  });
  const best = record.sort((x, y) => y.avg - x.avg)[0];
  if (!best || best.tryouts === 0) return Response.json({ role, best: null });
  return Response.json({
    role,
    label,
    candidates: agents.length + 1,
    best: {
      name: best.agent.name,
      builder: best.agent.builder,
      model: best.agent.model,
      description: best.agent.description,
      price_usd: best.agent.price_action_cents / 100,
      avg_score: best.avg,
      tryouts: best.tryouts,
      perfect_runs: best.perfect,
      checks: best.checks,
    },
  });
}
