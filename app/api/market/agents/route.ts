import { embed } from "@/app/api/agents/embed";
import { AGENT_COLUMNS, agentText, fillEmbeddings } from "@/lib/runtime/catalog";
import type { MarketAgent, Role } from "@/lib/market/types";
import { ensureBuilderAccount } from "@/lib/pay/stripe-market";
import { admin } from "@/lib/supabase-admin";

const ROLES: Role[] = ["calendar", "email", "auto_repair", "medical_billing", "web_design", "coding", "research"];
const ROLE_TOOLS: Record<Role, string[]> = {
  calendar: ["list_events", "create_event", "move_event", "cancel_event"],
  email: ["list_threads", "read_thread", "label_thread", "archive_thread", "create_draft"],
  auto_repair: ["lookup_dtc", "search_tsb", "parts_price", "labor_time", "write_estimate"],
  medical_billing: ["search_icd10", "search_cpt", "payer_rules", "submit_claim"],
  web_design: ["read_brief", "pick_palette", "pick_type", "compose_layout", "check_contrast", "deliver_design"],
  coding: [],
  research: [],
};
// Builders' prompts stay private to the runtime.
const COLUMNS = AGENT_COLUMNS.replace("system_prompt, ", "");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const q = url.searchParams.get("q")?.trim();
  const db = admin();

  let ranked: { id: string; similarity: number }[] | null = null;
  if (q) {
    await fillEmbeddings();
    const vec = await embed(q, "RETRIEVAL_QUERY");
    const { data, error } = await db.rpc("match_market_agents", {
      query_embedding: JSON.stringify(vec),
      match_count: 20,
      role_filter: role || null,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    ranked = data;
  }

  let query = db.from("market_agents").select(COLUMNS);
  if (role) query = query.eq("role", role);
  if (ranked) query = query.in("id", ranked.map((r) => r.id));
  const [{ data: agents, error }, { data: tryouts }, { data: hires }] = await Promise.all([
    query.order("created_at", { ascending: false }),
    db.from("tryouts").select("agent_id, score, status"),
    db.from("engagements").select("agent_id").eq("status", "active"),
  ]);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const record = (id: string) => {
    const mine = (tryouts ?? []).filter((t) => t.agent_id === id && t.status === "scored" && t.score !== null);
    const avg = mine.length ? mine.reduce((s, t) => s + Number(t.score), 0) / mine.length : null;
    return {
      tryouts: mine.length,
      avg_score: avg === null ? null : Math.round(avg * 10) / 10,
      hires: (hires ?? []).filter((h) => h.agent_id === id).length,
    };
  };
  const order = new Map((ranked ?? []).map((r, i) => [r.id, i]));
  const rows = (agents ?? []) as unknown as (Omit<MarketAgent, "system_prompt"> & { created_at: string })[];
  const list = rows
    .map((a) => ({
      ...a,
      similarity: ranked?.find((r) => r.id === a.id)?.similarity ?? null,
      track_record: record(a.id),
    }))
    .sort((a, b) => (ranked ? (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) : 0));
  return Response.json({ agents: list });
}

type PostBody = Partial<Omit<MarketAgent, "id" | "auditionable" | "stripe_account" | "runs_in">> & { email?: string };

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as PostBody | null;
  const missing = ["name", "builder", "email", "role", "description", "model", "system_prompt"].filter(
    (k) => !b?.[k as keyof PostBody],
  );
  if (!b || missing.length) return Response.json({ error: `missing ${missing.join(", ")}` }, { status: 400 });
  const role = b.role as Role;
  if (!ROLES.includes(role)) return Response.json({ error: "role must be calendar, email, coding or research" }, { status: 400 });

  const account = await ensureBuilderAccount(b.builder!, b.email!).catch(() => ({ stripe_account: null, onboarding_url: null }));
  const tools = (b.tools?.length ? b.tools : ROLE_TOOLS[role]).filter((t) => ROLE_TOOLS[role].includes(t));
  const embedding = await embed(agentText({ name: b.name!, role, description: b.description! }), "RETRIEVAL_DOCUMENT").catch(
    () => null,
  );
  const { data, error } = await admin()
    .from("market_agents")
    .insert({
      name: b.name,
      builder: b.builder,
      role,
      description: b.description,
      model: b.model,
      system_prompt: b.system_prompt,
      tools,
      price_month_cents: Math.max(0, Math.round(Number(b.price_month_cents ?? 1900))),
      price_action_cents: Math.max(0, Math.round(Number(b.price_action_cents ?? 10))),
      runs_in: "builder_url",
      auditionable: role === "calendar" || role === "email",
      stripe_account: account.stripe_account,
      embedding: embedding ? JSON.stringify(embedding) : null,
    })
    .select(COLUMNS)
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ agent: data, onboarding_url: account.onboarding_url });
}
