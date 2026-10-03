import { audioOf, gemini } from "@/lib/agents/gemini";
import { pcmToWav } from "@/lib/agents/wav";

export const maxDuration = 60;

const TTS_MODEL = "gemini-3.8-flash-tts";
const MAX_CHARS = 1200;

// Reads a short text aloud with Gemini TTS and returns the WAV.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.replace(/[*_#`>]/g, "").trim().slice(0, MAX_CHARS);
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });
  try {
    const res = await gemini(TTS_MODEL, {
      contents: [{ parts: [{ text: `### DIRECTOR'S NOTES\nStyle: confident specialist, clear and brisk.\n\n### TRANSCRIPT\n${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } },
      },
    });
    const data = audioOf(res);
    if (!data) return Response.json({ error: "no audio came back" }, { status: 502 });
    return new Response(new Uint8Array(pcmToWav(Buffer.from(data, "base64"))), { headers: { "content-type": "audio/wav" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "speech failed" }, { status: 502 });
  }
}
