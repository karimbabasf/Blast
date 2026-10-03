import { judgePanel } from "@/lib/judge/panel";
import type { AgentCard, JobRequest, JobResult, Verdict } from "@/lib/types";
import { fakeJudge, fakeRun } from "./fake";
import { withRetry } from "./retry";
import { runScript } from "./script";
import { runVoice } from "./voice";

// The one fake switch: BLAST_FAKE=1 swaps every agent and the judge for canned results.
function fake() {
  return process.env.BLAST_FAKE === "1";
}

// A builder's agent: POST the JobRequest to its endpoint and accept only a JobResult for that skill.
async function runExternal(card: AgentCard, req: JobRequest): Promise<JobResult> {
  const reply = await withRetry(async () => {
    const res = await fetch(card.endpoint!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${card.name} ${res.status}: endpoint refused the job`);
    return res.json().catch(() => {
      throw new Error(`${card.name} replied with something that is not JSON`);
    });
  });
  if (req.skill === "script") {
    const text = typeof reply?.text === "string" ? reply.text.trim() : "";
    if (!text) throw new Error(`${card.name} sent no script text`);
    return { agent_id: card.id, kind: "text", text: text.slice(0, 2000) };
  }
  const audio = typeof reply?.audio_url === "string" ? reply.audio_url : "";
  if (!/^https:\/\//.test(audio)) throw new Error(`${card.name} sent no https audio_url`);
  return { agent_id: card.id, kind: "audio", audio_url: audio };
}

export function runAgent(card: AgentCard, req: JobRequest): Promise<JobResult> {
  if (fake()) return fakeRun(card, req);
  if (card.endpoint) return runExternal(card, req);
  return req.skill === "script" ? runScript(card, req) : runVoice(card, req);
}

export function judgeResult(req: JobRequest, result: JobResult): Promise<Verdict> {
  if (fake()) return fakeJudge(result);
  return judgePanel(req, result);
}
