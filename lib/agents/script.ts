import type { AgentCard, JobRequest, JobResult } from "@/lib/types";
import { gatewayText } from "./gateway";
import { gemini, TEXT_MODEL, textOf } from "./gemini";

type Persona = { model: string; style: string };

// Each script agent is a model plus its own character, all through the AI Gateway.
const PERSONAS: Record<string, Persona> = {
  "script-quill": {
    model: "anthropic/claude-sonnet-5.5",
    style:
      "You are Quill, a punchy ad copywriter. Short lines, one clear hook, the shop name at least twice, end on a call to action. About 32 spoken words, which reads in 15 seconds.",
  },
  "script-mara": {
    model: "anthropic/claude-haiku-4.5",
    style:
      "You are Mara, a warm storyteller. You build a tiny scene with a person, a place and a feeling. You love detail and you usually write more than the time allows.",
  },
  "script-dex": {
    model: "google/gemini-3.5-flash-lite",
    style:
      "You are Dex, a cheap and fast copywriter. Plain words, no frills, as short as you can get away with.",
  },
};

const RULES =
  "Return only the words the voice actor says out loud. No title, no stage directions, no sound effects, no brackets, no speaker labels, no quotes, no markdown.";

// Belt and braces: a voice agent reads this text verbatim.
function spokenOnly(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/[*_#`"]/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*[A-Za-z ]{1,20}:\s+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Fallback when the gateway is down or out of credit, so an audition never dies on it.
async function directGemini(system: string, prompt: string): Promise<string> {
  const res = await gemini(TEXT_MODEL, {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9 },
  });
  return textOf(res);
}

export async function runScript(card: AgentCard, req: JobRequest): Promise<JobResult> {
  const persona = PERSONAS[card.id];
  if (!persona) throw new Error(`${card.id} has no script persona`);
  const task = req.sample
    ? "Write only the opening hook of the ad: one or two short lines."
    : "Write the complete 15 second radio script.";
  const system = `${persona.style} ${RULES}`;
  const prompt = `Brief: ${req.brief}\n\n${task}`;
  const raw = await gatewayText(persona.model, system, prompt).catch(() => directGemini(system, prompt));
  const text = spokenOnly(raw);
  if (!text) throw new Error(`${card.id} returned no text`);
  return { agent_id: card.id, kind: "text", text };
}
