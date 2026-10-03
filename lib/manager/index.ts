import { CARDS } from "@/lib/agents/cards";
import { gatewayText } from "@/lib/agents/gateway";
import type { Skill } from "@/lib/types";

export type SplitJob = { skill: Skill; brief: string };

const MODEL = "anthropic/claude-sonnet-5.5";
// SPEC.md: use the hardcoded split when Claude takes over 8 seconds.
const TIMEOUT_MS = 8_000;
const SKILLS: Skill[] = ["script", "voice"];

const SYSTEM = `You are the manager agent for Blast. You do not do the work yourself. You split a goal into jobs and hire specialist agents for each one.

Reply with JSON only, no prose and no code fence, in this exact shape:
{"jobs":[{"skill":"script","brief":"..."},{"skill":"voice","brief":"..."}]}

Rules:
- Use each of these skills exactly once, in this order: script, voice.
- A brief is one plain sentence, under 140 characters, that tells the specialist what to make.
- Keep every name from the goal spelled exactly as given.`;

// The split for the demo goal, and the fallback when Claude is slow or off.
export function fallbackSplit(goal: string): SplitJob[] {
  const subject = goal.trim().replace(/[.!?]+$/, "");
  return [
    { skill: "script", brief: `Write the script. Goal: ${subject}.` },
    { skill: "voice", brief: "Record the winning script as a radio voice-over." },
  ];
}

function parseSplit(raw: string): SplitJob[] | null {
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed: unknown = JSON.parse(json);
  const jobs = (parsed as { jobs?: unknown }).jobs;
  if (!Array.isArray(jobs)) return null;

  const split = SKILLS.map((skill) => {
    const job = jobs.find((j) => j?.skill === skill);
    const brief = typeof job?.brief === "string" ? job.brief.trim() : "";
    return { skill, brief: brief.slice(0, 200) };
  });
  return split.every((job) => job.brief) ? split : null;
}

export async function splitGoal(goal: string): Promise<SplitJob[]> {
  if (process.env.BLAST_FAKE === "1" || !process.env.AI_GATEWAY_API_KEY) {
    return fallbackSplit(goal);
  }

  const roster = CARDS.filter((card) => card.real)
    .map((card) => `- ${card.name} (${card.skills.join(", ")}): ${card.description}`)
    .join("\n");
  const prompt = `Goal: ${goal}\n\nSpecialists you can hire:\n${roster}`;

  try {
    const raw = await gatewayText(MODEL, SYSTEM, prompt, TIMEOUT_MS);
    return parseSplit(raw) ?? fallbackSplit(goal);
  } catch {
    return fallbackSplit(goal);
  }
}
