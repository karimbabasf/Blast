import { judge } from "@/lib/judge";
import type { AgentCard, JobRequest, JobResult, Verdict } from "@/lib/types";
import { fakeJudge, fakeRun } from "./fake";
import { runScript } from "./script";
import { runVoice } from "./voice";

// The one fake switch: BLAST_FAKE=1 swaps every agent and the judge for canned results.
function fake() {
  return process.env.BLAST_FAKE === "1";
}

export function runAgent(card: AgentCard, req: JobRequest): Promise<JobResult> {
  if (fake()) return fakeRun(card, req);
  return req.skill === "script" ? runScript(card, req) : runVoice(card, req);
}

export function judgeResult(req: JobRequest, result: JobResult): Promise<Verdict> {
  if (fake()) return fakeJudge(result);
  return judge(req, result);
}
