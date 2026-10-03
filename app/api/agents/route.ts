import { admin } from "@/lib/supabase-admin";
import type { Skill } from "@/lib/types";
import { agentText, embed } from "./embed";

export const dynamic = "force-dynamic";

// The only skills an audition can run today.
const SKILLS: Skill[] = ["script", "voice"];

type Agent = {
  id: string;
  name: string;
  skills: string[];
  description: string;
  price_cents: number;
  builder: string;
  similarity?: number;
};

type ScoreRow = { agent_id: string; skill: string; auditions: number; avg_score: number | null; hires: number };

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}

// Seeded or hand-inserted rows have no vector yet; give them one before searching.
async function fillMissingEmbeddings() {
  const db = admin();
  const { data } = await db.from("agents").select("id, name, skills, description").is("embedding", null);
  for (const agent of data ?? []) {
    const embedding = await embed(agentText(agent), "RETRIEVAL_DOCUMENT");
    await db.from("agents").update({ embedding }).eq("id", agent.id);
  }
}

// One track record per agent: the asked skill, else every skill together.
async function trackRecords(skill: string | null) {
  let query = admin().from("agent_scorecard").select("agent_id, skill, auditions, avg_score, hires");
  if (skill) query = query.eq("skill", skill);
  const { data } = await query;
  const records = new Map<string, { auditions: number; hires: number; total: number }>();
  for (const row of (data ?? []) as ScoreRow[]) {
    const r = records.get(row.agent_id) ?? { auditions: 0, hires: 0, total: 0 };
    r.auditions += Number(row.auditions);
    r.hires += Number(row.hires);
    r.total += Number(row.avg_score ?? 0) * Number(row.auditions);
    records.set(row.agent_id, r);
  }
  return records;
}

type RunsIn = "sandbox" | "builder_url" | "blast";

// Where each listed agent runs. Only the kind leaves this route, never the code or the URL.
async function runsIn(): Promise<Map<string, RunsIn>> {
  const { data } = await admin()
    .from("agents")
    .select("id, endpoint, code")
    .or("endpoint.not.is.null,code.not.is.null");
  const kinds = new Map<string, RunsIn>();
  for (const row of data ?? []) kinds.set(row.id, row.code ? "sandbox" : "builder_url");
  return kinds;
}

// GET /api/agents?q=<need>&skill=<optional>: closest meaning first; near ties go to the better track record.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() || null;
  const skill = params.get("skill") || null;
  const db = admin();

  let agents: Agent[];
  try {
    if (q) {
      await fillMissingEmbeddings();
      const queryEmbedding = await embed(q.slice(0, 500), "RETRIEVAL_QUERY");
      const { data, error } = await db.rpc("match_agents", {
        query_embedding: queryEmbedding,
        match_count: 10,
        skill,
      });
      if (error) throw new Error(error.message);
      agents = data as Agent[];
    } else {
      let query = db.from("agents").select("id, name, skills, description, price_cents, builder");
      if (skill) query = query.contains("skills", [skill]);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      agents = data as Agent[];
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  // One builder agent can be listed twice (a localhost and a deployed endpoint): show it once,
  // with the track record of both copies.
  const [records, kinds] = await Promise.all([trackRecords(skill), runsIn()]);
  const groups = new Map<string, { agent: Agent; auditions: number; hires: number; total: number }>();
  for (const agent of agents) {
    const key = `${agent.builder}\n${agent.name}`;
    const group = groups.get(key) ?? { agent, auditions: 0, hires: 0, total: 0 };
    const r = records.get(agent.id);
    group.auditions += r?.auditions ?? 0;
    group.hires += r?.hires ?? 0;
    group.total += r?.total ?? 0;
    groups.set(key, group);
  }

  const ranked = [...groups.values()]
    .map(({ agent, auditions, hires, total }) => ({
      ...agent,
      runs_in: kinds.get(agent.id) ?? "blast",
      similarity: agent.similarity === undefined ? null : Math.round(agent.similarity * 1000) / 1000,
      avg_score: auditions ? Math.round((total / auditions) * 10) / 10 : null,
      auditions,
      hires,
    }))
    .sort(
      (a, b) =>
        Math.round((b.similarity ?? 0) * 100) - Math.round((a.similarity ?? 0) * 100) ||
        (b.avg_score ?? -1) - (a.avg_score ?? -1),
    );
  return Response.json({ agents: ranked });
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function validEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 300) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function text(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

// POST /api/agents: a builder lists an agent. It auditions on the next job for its skills.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("body must be JSON");
  const { name, skills, description, price_cents, endpoint, builder } = body;

  if (!text(name, 1, 40)) return bad("name must be 1 to 40 characters");
  if (!text(builder, 1, 60)) return bad("builder must be 1 to 60 characters");
  if (!text(description, 10, 300)) return bad("description must be 10 to 300 characters");
  if (
    !Array.isArray(skills) ||
    !skills.length ||
    !skills.every((s) => SKILLS.includes(s)) ||
    new Set(skills).size !== skills.length
  ) {
    return bad("skills must be a non-empty list of script and/or voice");
  }
  if (!Number.isInteger(price_cents) || price_cents < 50 || price_cents > 2000) {
    return bad("price_cents must be a whole number from 50 to 2000");
  }
  if (!validEndpoint(endpoint)) return bad("endpoint must be an https URL, or http://localhost for dev");

  const agent = {
    name: name.trim(),
    skills: skills as Skill[],
    description: description.trim(),
    price_cents,
    real: true,
    endpoint,
    builder: builder.trim(),
  };
  let embedding: number[];
  try {
    embedding = await embed(agentText(agent), "RETRIEVAL_DOCUMENT");
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }

  const base = slug(`${agent.name}-${agent.builder}`) || "agent";
  const db = admin();
  for (let n = 1; n <= 5; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    const { error } = await db.from("agents").insert({ id, ...agent, embedding });
    if (!error) return Response.json({ agent: { id, ...agent } }, { status: 201 });
    if (error.code !== "23505") return Response.json({ error: error.message }, { status: 500 });
  }
  return bad("too many agents with this name and builder");
}
