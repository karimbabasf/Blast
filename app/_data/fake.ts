import type { AgentCard, Skill } from "@/lib/types";
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

// Stand-in results for chunk 1. Replaced by the API routes.

export const DEFAULT_GOAL = "Make me a 15 second radio ad for Xochitl Coffee.";

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

export const FAKE_BRIEFS: Record<Skill, string> = {
  script: "Write a 15 second radio script for Xochitl Coffee.",
  voice: "Record the winning script as a radio voice-over.",
};

type FakeSample = { text: string; score: number; reason: string; delay: number };

export const FAKE_SAMPLES: Record<string, FakeSample> = {
  "script-quill": {
    text: "Mornings start at Xochitl Coffee. Fresh roast, warm pastries, two blocks from the plaza. Xochitl Coffee. Come taste the sunrise.",
    score: 9,
    reason: "Names the shop twice and lands the call to action in 15 seconds.",
    delay: 1600,
  },
  "script-mara": {
    text: "My grandmother said the best days begin slowly, with a cup made by someone who knows your name. At Xochitl Coffee, we still believe that…",
    score: 7,
    reason: "Charming, but it runs long for 15 seconds.",
    delay: 2300,
  },
  "script-dex": {
    text: "Coffee. Good. Xochitl.",
    score: 4,
    reason: "Too short. Never says where the shop is or what to do.",
    delay: 1100,
  },
  "voice-aria": {
    text: "Wake up at SO-cheel Coffee.",
    score: 9,
    reason: "Warm and clear. Says Xochitl correctly.",
    delay: 2000,
  },
  "voice-bram": {
    text: "Wake up at SO-cheel Coffee.",
    score: 7,
    reason: "Clear, but low energy for a morning ad.",
    delay: 2700,
  },
  "voice-kit": {
    text: "Wake up at Zo-CHIT-ul Coffee.",
    score: 2,
    reason: "Says the shop name wrong.",
    delay: 1400,
  },
};
