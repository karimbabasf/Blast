import type { AgentCard } from "@/lib/types";
import imagePixel from "@/agents/cards/image-pixel.json";
import musicTempo from "@/agents/cards/music-tempo.json";
import scriptDex from "@/agents/cards/script-dex.json";
import scriptLex from "@/agents/cards/script-lex.json";
import scriptMara from "@/agents/cards/script-mara.json";
import scriptQuill from "@/agents/cards/script-quill.json";
import translatePolyglot from "@/agents/cards/translate-polyglot.json";
import videoReel from "@/agents/cards/video-reel.json";
import voiceAria from "@/agents/cards/voice-aria.json";
import voiceBram from "@/agents/cards/voice-bram.json";
import voiceKit from "@/agents/cards/voice-kit.json";
import voiceNova from "@/agents/cards/voice-nova.json";

export const CARDS = [
  scriptQuill,
  scriptMara,
  scriptDex,
  scriptLex,
  voiceAria,
  voiceBram,
  voiceKit,
  voiceNova,
  musicTempo,
  imagePixel,
  videoReel,
  translatePolyglot,
] as AgentCard[];

export function cardById(id: string): AgentCard | undefined {
  return CARDS.find((card) => card.id === id);
}

function isLocal(endpoint: string | null | undefined) {
  return Boolean(endpoint && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(endpoint));
}

const COLUMNS = "id, name, skills, description, price_cents, real, endpoint, builder";

// Registry rows that can run: an endpoint, or builder code once the code column exists.
async function registryRows(): Promise<AgentCard[]> {
  const { admin } = await import("@/lib/supabase-admin");
  const db = admin();
  const withCode = await db
    .from("agents")
    .select(`${COLUMNS}, code`)
    .or("endpoint.not.is.null,code.not.is.null")
    .order("created_at");
  if (!withCode.error) return withCode.data as AgentCard[];
  const { data, error } = await db
    .from("agents")
    .select(COLUMNS)
    .not("endpoint", "is", null)
    .order("created_at");
  return error ? [] : (data as AgentCard[]);
}

// The JSON cards plus every builder agent in the registry that can run. A deploy skips
// localhost endpoints; local dev prefers a builder's localhost copy over its deployed one.
export async function loadCards(): Promise<AgentCard[]> {
  if (process.env.BLAST_FAKE === "1") return CARDS;
  const onVercel = Boolean(process.env.VERCEL);
  const listed = (await registryRows()).filter(
    (card) => !cardById(card.id) && !(onVercel && isLocal(card.endpoint)),
  );
  const external = listed.filter(
    (card) =>
      onVercel ||
      !card.endpoint ||
      isLocal(card.endpoint) ||
      !listed.some(
        (other) => other.builder === card.builder && other.name === card.name && isLocal(other.endpoint),
      ),
  );
  return [...CARDS, ...external];
}
