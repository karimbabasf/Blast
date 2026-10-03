import { auditionJob } from "@/lib/agents/pipeline";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = body?.job_id;
  if (typeof jobId !== "string" || !UUID.test(jobId)) {
    return Response.json({ error: "job_id must be a UUID" }, { status: 400 });
  }
  const result = await auditionJob(jobId);
  return Response.json(result.body, { status: result.status });
}
