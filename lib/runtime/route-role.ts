// Maps a request to the role of agent it needs: a fast model first, keywords as the fallback.

import { gatewayText } from "@/lib/agents/gateway";
import type { Role } from "@/lib/market/types";

const ROLES: Role[] = ["calendar", "email", "auto_repair", "medical_billing", "coding", "research"];

function keywordRole(text: string): Role {
  const t = text.toLowerCase();
  if (/\b(car|engine|misfire|obd|p0\d{3}|civic|mechanic|brake|check engine)\b/.test(t)) return "auto_repair";
  if (/icd|cpt|billing|claim|visit note|patient|coder|medical/.test(t)) return "medical_billing";
  if (/calendar|schedul|meeting|book/.test(t)) return "calendar";
  if (/email|inbox|mail/.test(t)) return "email";
  if (/code|coding|bug|repo/.test(t)) return "coding";
  return "research";
}

export async function mapRole(text: string): Promise<Role> {
  try {
    const raw = await gatewayText(
      "anthropic/claude-haiku-4.5",
      "You route a request for an AI agent to one role. Roles: auto_repair (diagnosing and pricing car repairs), medical_billing (coding visits and claims for billing), calendar (scheduling, booking meetings), email (inbox, mail), coding (software), research (finding information). Reply with only the role word.",
      text,
      10_000,
    );
    const role = raw.toLowerCase().match(/auto_repair|medical_billing|calendar|email|coding|research/)?.[0] as Role | undefined;
    return role && ROLES.includes(role) ? role : keywordRole(text);
  } catch {
    return keywordRole(text);
  }
}
