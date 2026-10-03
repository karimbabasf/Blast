// An agent hires a specialist on someone's behalf: tryouts on the role's test job, the winner does the
// real job, and the held payment is captured only when the winner proved itself.

import type { Check, MarketAgent, Need, Role } from "@/lib/market/types";
import { settle, type Hold } from "@/lib/pay/proof";
import { lastOutput } from "@/lib/roles/specialists";
import { createWorld, worldCalendar, worldMail } from "@/lib/roles/world";
import { admin } from "@/lib/supabase-admin";
import { runAgent, type Usage } from "./agent";
import { pickCandidates } from "./catalog";
import { mapRole } from "./route-role";
import { createTryouts, runTryouts } from "./tryout";

const OUTPUT_KIND: Partial<Record<Role, string>> = { auto_repair: "estimate", medical_billing: "claim" };

type TryoutRow = { agent_id: string; score: number | null; status: string; checks: Check[]; usage: Usage | null };

export function siteUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3100";
}

export async function startNeed(job: string, source: "claude-code" | "web", hold: Hold | null) {
  const role = await mapRole(job);
  const { data, error } = await admin()
    .from("needs")
    .insert({ text: job, role, capabilities: ["act"], answers: [], status: "auditioning", source, hold })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Need;
}

export async function hireOnProof(need: Need, hold: Hold | null) {
  const db = admin();
  const { picked } = await pickCandidates(need.role, need.text);
  if (!picked.length) throw new Error(`no specialists listed for ${need.role}`);
  const tryouts = await createTryouts(need, picked);
  await runTryouts(need, picked, tryouts);

  const { data } = await db.from("tryouts").select("agent_id, score, status, checks, usage").eq("need_id", need.id);
  const rows = (data ?? []) as TryoutRow[];
  const passedAll = (r: TryoutRow) => r.status === "scored" && r.checks.length > 0 && r.checks.every((c) => c.passed);
  const best = rows.filter(passedAll).sort((a, b) => Number(b.score) - Number(a.score))[0];
  const winner = best ? picked.find((a) => a.id === best.agent_id) ?? null : null;

  let result: { agent_id: string; agent_name: string; reply: string; output: unknown } | null = null;
  if (winner) {
    await db.from("needs").update({ status: "checkout" }).eq("id", need.id);
    try {
      const worldId = await createWorld(null);
      const run = await runAgent(
        winner,
        need.text,
        { calendar: worldCalendar(worldId), mail: worldMail(worldId), worldId, builder: winner.builder },
        async () => {},
      );
      const kind = OUTPUT_KIND[need.role];
      result = { agent_id: winner.id, agent_name: winner.name, reply: run.reply, output: kind ? await lastOutput(worldId, kind) : null };
    } catch (err) {
      result = null;
      await db.from("needs").update({ result: { error: err instanceof Error ? err.message : String(err) } }).eq("id", need.id);
    }
  }

  const paid = hold ? await settle(hold, result && winner ? { id: winner.id, price_cents: winner.price_action_cents, stripe_account: winner.stripe_account } : null) : null;
  await db
    .from("needs")
    .update({ status: result ? "hired" : "waiting", result, hold: paid })
    .eq("id", need.id);

  return summary(need, picked, rows, winner, result, paid);
}

function summary(
  need: Need,
  agents: MarketAgent[],
  rows: TryoutRow[],
  winner: MarketAgent | null,
  result: { reply: string; output: unknown } | null,
  hold: Hold | null,
) {
  return {
    need_id: need.id,
    live_url: `${siteUrl()}/?need=${need.id}`,
    role: need.role,
    winner: winner ? { name: winner.name, builder: winner.builder, model: winner.model, price_usd: winner.price_action_cents / 100 } : null,
    result,
    tryouts: rows
      .map((r) => {
        const a = agents.find((x) => x.id === r.agent_id);
        return {
          agent: a?.name,
          builder: a?.builder,
          model: a?.model,
          score: r.score === null ? null : Number(r.score),
          checks: `${r.checks.filter((c) => c.passed).length}/${r.checks.length}`,
          failed: r.checks.filter((c) => !c.passed).map((c) => c.name),
          token_cost_usd: r.usage ? Number(r.usage.cost_usd.toFixed(4)) : null,
        };
      })
      .sort((a, b) => Number(b.score ?? -1) - Number(a.score ?? -1)),
    payment: hold,
  };
}
