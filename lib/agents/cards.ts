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
