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
export type SearchMatch = { id: string; name: string; builder: string; role: Role; similarity: number };

export async function pickCandidates(
  role: Role,
  needText: string,
): Promise<{ all: MarketAgent[]; picked: MarketAgent[]; matches: SearchMatch[]; listings: number }> {
  const db = admin();
  const { data, error } = await db.from("market_agents").select(AGENT_COLUMNS).eq("role", role);
  if (error) throw new Error(error.message);
  const all = data as MarketAgent[];
  let ranked = all.filter((a) => a.auditionable);
  let matches: SearchMatch[] = [];
  let listings = all.length;

  try {
    await fillEmbeddings();
    const vec = await embed(needText, "RETRIEVAL_QUERY");
    // The whole Hub is searched by meaning; the role then narrows who auditions.
    const [{ data: hits }, { count }] = await Promise.all([
      db.rpc("match_market_agents", { query_embedding: JSON.stringify(vec), match_count: 50, role_filter: null }),
      db.from("market_agents").select("id", { count: "exact", head: true }),
    ]);
    const scored = (hits ?? []) as { id: string; similarity: number }[];
    listings = count ?? listings;
    const { data: named } = await db
      .from("market_agents")
      .select("id, name, builder, role")
      .in("id", scored.slice(0, 8).map((h) => h.id));
    matches = scored.slice(0, 8).flatMap((h) => {
      const a = (named ?? []).find((n) => n.id === h.id);
      return a ? [{ ...a, similarity: Math.round(h.similarity * 100) / 100 } as SearchMatch] : [];
    });
    const order = new Map(scored.filter((h) => all.some((a) => a.id === h.id)).map((m, i) => [m.id, i]));
    ranked = [...ranked].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  } catch {
    // Without embeddings the list keeps its table order, which still audition fine.
  }

  // Pip auditions for every calendar need: the weak indie agent is the contrast the demo shows.
  const pinned = ranked.filter((a) => a.id === PINNED[role]);
  const picked = [...pinned, ...ranked.filter((a) => a.id !== PINNED[role])].slice(0, MAX_CANDIDATES);
  const outsider = ranked.find((a) => a.builder !== "Blast");
  if (outsider && !picked.some((a) => a.builder !== "Blast")) picked[picked.length - 1] = outsider;
  return { all, picked, matches, listings };
}
