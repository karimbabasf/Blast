import type { AgentCard, JobRequest, JobResult } from "@/lib/types";

export async function runVoice(card: AgentCard, req: JobRequest): Promise<JobResult> {
  throw new Error(`voice agent ${card.id} is not built yet (job ${req.job_id})`);
}
