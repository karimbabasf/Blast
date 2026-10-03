import { CARDS } from "@/lib/agents/cards";
import { admin } from "@/lib/supabase-admin";
import type { Skill } from "@/lib/types";

export const dynamic = "force-dynamic";

const SKILLS: Skill[] = ["script", "voice"];

type Row = {
  agent_id: string;
  skill: Skill;
  auditions: number;
  avg_score: number | null;
  hires: number;
  failures: number;
};

// GET /api/scorecard?skill=voice: every hireable agent for that skill, best track record first.
export async function GET(req: Request) {
  const skill = new URL(req.url).searchParams.get("skill") as Skill | null;
  if (!skill || !SKILLS.includes(skill)) {
    return Response.json({ error: "skill must be script or voice" }, { status: 400 });
  }
  const { data, error } = await admin().from("agent_scorecard").select("*").eq("skill", skill);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const record = new Map((data as Row[]).map((row) => [row.agent_id, row]));

  const agents = CARDS.filter((card) => card.real && card.skills.includes(skill))
    .map((card) => {
      const row = record.get(card.id);
      return {
        agent_id: card.id,
        name: card.name,
        description: card.description,
        price_cents: card.price_cents,
        auditions: row?.auditions ?? 0,
        avg_score: row?.avg_score === null || row?.avg_score === undefined ? null : Number(row.avg_score),
        hires: row?.hires ?? 0,
        failures: row?.failures ?? 0,
      };
    })
    .sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1));

  return Response.json({ skill, agents });
}
