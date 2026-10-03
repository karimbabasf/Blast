import { cardById, loadCards } from "@/lib/agents/cards";
import type { AgentCard, Skill } from "@/lib/types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Hire = {
  id: string;
  run_id: string;
  job_id: string;
  agent_id: string;
  skill: Skill;
  price_cents: number | null;
  calls: number;
  created_at: string;
};

export async function findCard(agentId: string): Promise<AgentCard | undefined> {
  const cards = await loadCards().catch(() => []);
  return cards.find((card) => card.id === agentId) ?? cardById(agentId);
}

// What the "your agent is ready" screen and other agents need to start calling a hire.
export function hireCard(
  hire: Hire,
  card: AgentCard | undefined,
  origin: string,
  liveScore: number | null,
) {
  const endpoint = `${origin}/api/hired/${hire.id}`;
  const example =
    hire.skill === "voice"
      ? "Fresh pan dulce every morning at Xochitl Coffee."
      : "our new oat milk horchata latte";
  return {
    hire_id: hire.id,
    run_id: hire.run_id,
    job_id: hire.job_id,
    agent_id: hire.agent_id,
    name: card?.name ?? hire.agent_id,
    builder: card?.builder ?? "Blast",
    skill: hire.skill,
    input: hire.skill === "voice" ? "the text to read aloud" : "what the 15 second radio script is about",
    price_cents: hire.price_cents ?? card?.price_cents ?? null,
    calls: hire.calls,
    avg_live_score: liveScore,
    endpoint,
    curl: `curl -X POST ${endpoint} -H 'content-type: application/json' -d '${JSON.stringify({ input: example })}'`,
  };
}

export function average(scores: (number | string | null)[]): number | null {
  const real = scores.filter((s) => s !== null).map(Number);
  if (!real.length) return null;
  return Math.round((real.reduce((sum, s) => sum + s, 0) / real.length) * 10) / 10;
}
