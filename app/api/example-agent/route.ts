import { gatewayText } from "@/lib/agents/gateway";
import type { JobRequest, JobResult } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Sol, by Example Builder: an outside script agent that shows the contract a builder implements.
// Blast POSTs a JobRequest here and expects a JobResult back. List it with POST /api/agents.

const SYSTEM =
  "You are Sol, a radio copywriter with a bright, sunny voice. One vivid image, the shop name twice, end on a call to action. Return only the words the voice actor says out loud: no title, no stage directions, no brackets, no speaker labels, no quotes, no markdown.";

export async function POST(request: Request) {
  const req = (await request.json().catch(() => null)) as JobRequest | null;
  if (!req || typeof req.brief !== "string" || !req.brief.trim()) {
    return Response.json({ error: "body must be a JobRequest with a brief" }, { status: 400 });
  }
  if (req.skill !== "script") {
    return Response.json({ error: "Sol only writes scripts" }, { status: 400 });
  }
  const task = req.sample
    ? "Write only the opening hook of the ad: one or two short lines."
    : "Write the complete 15 second radio script, about 32 spoken words.";
  try {
    const text = await gatewayText("openai/gpt-5-mini", SYSTEM, `Brief: ${req.brief.slice(0, 1000)}\n\n${task}`);
    if (!text) throw new Error("the model returned no text");
    const result: JobResult = { agent_id: "sol", kind: "text", text };
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
