import type { JobRequest, JobResult, Verdict } from "@/lib/types";

export async function judge(req: JobRequest, result: JobResult): Promise<Verdict> {
  throw new Error(`judge is not built yet (job ${req.job_id}, agent ${result.agent_id})`);
}
