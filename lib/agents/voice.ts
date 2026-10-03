import { audioOf, gemini } from "@/lib/agents/gemini";
import { withRetry } from "@/lib/agents/retry";
import { pcmToWav } from "@/lib/agents/wav";
import { admin } from "@/lib/supabase-admin";
import type { AgentCard, JobRequest, JobResult } from "@/lib/types";

const TTS_MODEL = "gemini-3.8-flash-tts";

type Persona = {
  voice: string;
  style: string;
  spell: (text: string) => string;
};

// Aria and Bram get the name spelled the way it sounds. Kit has no pronunciation help and reads it
// the naive English way: plain "Xochitl" came out right 4 times in 5, so Kit spells it as it looks.
const PERSONAS: Record<string, Persona> = {
  "voice-aria": {
    voice: "Sulafat",
    style: "warm, upbeat morning radio host",
    spell: (t) => t.replace(/xochitl/gi, "So-cheeel"),
  },
  "voice-bram": {
    voice: "Charon",
    style: "deep, calm, late night FM voice",
    spell: (t) => t.replace(/xochitl/gi, "So-cheeel"),
  },
  "voice-kit": {
    voice: "Zephyr",
    style: "bright and fast, morning show energy",
    spell: (t) => t.replace(/xochitl/gi, "Zo-chittle"),
  },
};

export async function runVoice(
  card: AgentCard,
  req: JobRequest,
): Promise<JobResult> {
  const persona = PERSONAS[card.id];
  if (!persona) throw new Error(`no voice set up for ${card.id}`);
  const line = (req.input_text ?? req.brief).trim();
  const spoken = persona.spell(line);

  // Gemini TTS reads a "Say X:" prefix aloud. This notes format keeps the style out of the audio.
  const prompt = `### DIRECTOR'S NOTES\nStyle: ${persona.style}.\n\n### TRANSCRIPT\n${spoken}`;

  const pcm = await withRetry(async () => {
    const res = await gemini(TTS_MODEL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: persona.voice } },
        },
      },
    });
    const data = audioOf(res);
    if (!data) throw new Error(`${card.name} got no audio from ${TTS_MODEL}`);
    return Buffer.from(data, "base64");
  });

  const path = `${req.job_id}/${card.id}-${req.sample ? "sample" : "full"}.wav`;
  const bucket = admin().storage.from("audio");
  const { error } = await bucket.upload(path, pcmToWav(pcm), {
    contentType: "audio/wav",
    upsert: true,
  });
  if (error)
    throw new Error(`audio upload failed for ${card.name}: ${error.message}`);

  return {
    agent_id: card.id,
    kind: "audio",
    audio_url: bucket.getPublicUrl(path).data.publicUrl,
    text: line,
  };
}
