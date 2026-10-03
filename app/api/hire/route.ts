import { hire } from "@/lib/agents/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = body?.job_id;
  const runId = body?.run_id;
  const id = typeof jobId === "string" ? jobId : runId;
  if (typeof id !== "string" || !UUID.test(id)) {
    return Response.json({ error: "send job_id or run_id as a UUID" }, { status: 400 });
  }
  const result = await hire(typeof jobId === "string" ? { job_id: jobId } : { run_id: runId });
  return Response.json(result.body, { status: result.status });
}
