import type { AgentCard, JobRequest, JobResult } from "@/lib/types";
import { gemini, LITE_MODEL, TEXT_MODEL, textOf } from "./gemini";

type Persona = { model: string; style: string };

// Each script agent is a model plus its own character.
const PERSONAS: Record<string, Persona> = {
  "script-quill": {
    model: TEXT_MODEL,
    style:
      "You are Quill, a punchy ad copywriter. Short lines, one clear hook, the shop name at least twice, end on a call to action. About 35 spoken words for 15 seconds.",
  },
  "script-mara": {
    model: TEXT_MODEL,
    style:
      "You are Mara, a warm storyteller. You build a tiny scene with a person, a place and a feeling. You love detail and you usually write more than the time allows.",
  },
  "script-dex": {
    model: LITE_MODEL,
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

export async function runScript(card: AgentCard, req: JobRequest): Promise<JobResult> {
  const persona = PERSONAS[card.id];
  if (!persona) throw new Error(`${card.id} has no script persona`);
  const task = req.sample
    ? "Write only the opening hook of the ad: one or two short lines."
    : "Write the complete 15 second radio script.";
  const res = await gemini(persona.model, {
    systemInstruction: { parts: [{ text: `${persona.style} ${RULES}` }] },
    contents: [{ role: "user", parts: [{ text: `Brief: ${req.brief}\n\n${task}` }] }],
    generationConfig: { temperature: 0.9 },
  });
  const text = spokenOnly(textOf(res));
  if (!text) throw new Error(`${card.id} returned no text`);
  return { agent_id: card.id, kind: "text", text };
}
