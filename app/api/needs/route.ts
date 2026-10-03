import { after } from "next/server";
import { gatewayText } from "@/lib/agents/gateway";
import type { Capability, MarketAgent, Need, Role } from "@/lib/market/types";
import { pickCandidates } from "@/lib/runtime/catalog";
import { answersText, cleanAnswers } from "@/lib/runtime/clarify";
import { createTryouts, runTryouts } from "@/lib/runtime/tryout";
import { admin } from "@/lib/supabase-admin";

export const maxDuration = 300;

const ROLES: Role[] = ["calendar", "email", "coding", "research"];

function keywordRole(text: string): Role {
  const t = text.toLowerCase();
  if (/calendar|schedul|meeting|book/.test(t)) return "calendar";
  if (/email|inbox|mail/.test(t)) return "email";
  if (/code|coding|bug|repo/.test(t)) return "coding";
  return "research";
}

async function mapRole(text: string): Promise<Role> {
  try {
    const raw = await gatewayText(
      "anthropic/claude-haiku-4.5",
      "You route a business's request for an AI agent to one role. Roles: calendar (scheduling, booking meetings), email (inbox, mail), coding (software), research (finding information). Reply with only the role word.",
      text,
      10_000,
    );
    const role = raw.toLowerCase().match(/calendar|email|coding|research/)?.[0] as Role | undefined;
    return role && ROLES.includes(role) ? role : keywordRole(text);
  } catch {
    return keywordRole(text);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    text?: string;
    capabilities?: Capability[];
    answers?: unknown;
  } | null;
  const text = body?.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  const capabilities = (body?.capabilities ?? []).filter((c) => c === "talk" || c === "act");

  const answers = cleanAnswers(body?.answers);
  // The answers sharpen both the role and the match ("Calendar, email, or both? My email").
  const fullText = answers.length ? `${text}\n${answersText(answers)}` : text;

  const db = admin();
  const role = await mapRole(fullText);
  const { data: need, error } = await db
    .from("needs")
    .insert({ text, role, capabilities, answers, status: "auditioning" })
    .select("*")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { all: listed, picked: candidates } = await pickCandidates(role, fullText).catch(() => ({
    all: [] as MarketAgent[],
    picked: [] as MarketAgent[],
  }));

  if (!candidates.length) {
    await db.from("needs").update({ status: "waiting" }).eq("id", need.id);
    return Response.json({ need: { ...need, status: "waiting" }, agents: [], listed });
  }
  const tryouts = await createTryouts(need as Need, candidates);
  after(() => runTryouts(need as Need, candidates, tryouts));
  return Response.json({ need, agents: candidates, listed });
}
