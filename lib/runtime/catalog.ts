// The market catalog: meaning vectors for listings, and which agents audition for a need.

import { embed } from "@/app/api/agents/embed";
import type { MarketAgent, Role } from "@/lib/market/types";
import { admin } from "@/lib/supabase-admin";

export const AGENT_COLUMNS =
  "id, name, builder, role, description, model, system_prompt, tools, price_month_cents, price_action_cents, runs_in, auditionable, stripe_account, created_at";

const MAX_CANDIDATES = 5;
const PINNED: Partial<Record<Role, string>> = {
  calendar: "cal-pip",
  auto_repair: "auto-generalist",
  medical_billing: "med-generalist",
};

export const agentText = (a: { name: string; role: string; description: string }) =>
  `${a.name}. ${a.role} agent. ${a.description}`;

// Listings without a meaning vector get one here, so search covers them from then on.
export async function fillEmbeddings(): Promise<void> {
  const db = admin();
  const { data } = await db.from("market_agents").select("id, name, role, description").is("embedding", null);
  await Promise.allSettled(
    (data ?? []).map(async (a) => {
      const vec = await embed(agentText(a), "RETRIEVAL_DOCUMENT");
      await db.from("market_agents").update({ embedding: JSON.stringify(vec) }).eq("id", a.id);
    }),
  );
}

// The 5 auditionable agents of the role closest to the need, always with at least one outside builder.
export async function pickCandidates(role: Role, needText: string): Promise<{ all: MarketAgent[]; picked: MarketAgent[] }> {
  const db = admin();
  const { data, error } = await db.from("market_agents").select(AGENT_COLUMNS).eq("role", role);
  if (error) throw new Error(error.message);
  const all = data as MarketAgent[];
  let ranked = all.filter((a) => a.auditionable);

  try {
    await fillEmbeddings();
    const vec = await embed(needText, "RETRIEVAL_QUERY");
    const { data: matches } = await db.rpc("match_market_agents", {
      query_embedding: JSON.stringify(vec),
      match_count: 50,
      role_filter: role,
    });
    const order = new Map(((matches ?? []) as { id: string }[]).map((m, i) => [m.id, i]));
    ranked = [...ranked].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  } catch {
    // Without embeddings the list keeps its table order, which still audition fine.
  }

  // Pip auditions for every calendar need: the weak indie agent is the contrast the demo shows.
  const pinned = ranked.filter((a) => a.id === PINNED[role]);
  const picked = [...pinned, ...ranked.filter((a) => a.id !== PINNED[role])].slice(0, MAX_CANDIDATES);
  const outsider = ranked.find((a) => a.builder !== "Blast");
  if (outsider && !picked.some((a) => a.builder !== "Blast")) picked[picked.length - 1] = outsider;
  return { all, picked };
}
