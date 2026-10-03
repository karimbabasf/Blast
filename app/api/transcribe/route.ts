import { gemini, TEXT_MODEL, textOf } from "@/lib/agents/gemini";

export const maxDuration = 60;

const MAX_BYTES = 4_000_000;

// Turns a short voice recording into text with Gemini.
export async function POST(req: Request) {
  const audio = await req.arrayBuffer();
  if (!audio.byteLength) return Response.json({ error: "audio is required" }, { status: 400 });
  if (audio.byteLength > MAX_BYTES) return Response.json({ error: "recording is too long" }, { status: 413 });
  const mimeType = (req.headers.get("content-type") ?? "audio/webm").split(";")[0];
  try {
    const res = await gemini(TEXT_MODEL, {
      contents: [
        {
          parts: [
            { text: "Write down exactly what the speaker says. Reply with only their words, no quotes and no comments. If there is no speech, reply with nothing." },
            { inlineData: { mimeType, data: Buffer.from(audio).toString("base64") } },
          ],
        },
      ],
    });
    return Response.json({ text: textOf(res) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "transcription failed" }, { status: 502 });
  }
}
