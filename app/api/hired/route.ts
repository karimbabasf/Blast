import { admin } from "@/lib/supabase-admin";
import { average, findCard, hireCard, UUID, type Hire } from "./card";

export const dynamic = "force-dynamic";

// GET /api/hired?run_id=...: the agents a run hired, each ready to call at its own endpoint.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("run_id");
  if (!runId || !UUID.test(runId)) {
    return Response.json({ error: "run_id must be a UUID" }, { status: 400 });
  }
  const db = admin();
  const { data, error } = await db.from("hires").select("*").eq("run_id", runId).order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const hires = data as Hire[];

  const { data: calls } = await db
    .from("hire_calls")
    .select("hire_id, score")
    .in("hire_id", hires.map((h) => h.id));
  const cards = await Promise.all(hires.map((h) => findCard(h.agent_id)));

  return Response.json({
    run_id: runId,
    hires: hires.map((hire, i) =>
      hireCard(
        hire,
        cards[i],
        url.origin,
        average((calls ?? []).filter((c) => c.hire_id === hire.id).map((c) => c.score)),
      ),
    ),
  });
}
