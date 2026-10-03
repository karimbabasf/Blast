import { audioOf, gemini } from "@/lib/agents/gemini";
import { pcmToWav } from "@/lib/agents/wav";
import type { MarketAgent } from "@/lib/market/types";
import { meterAction } from "@/lib/pay/stripe-market";
import { runAgent, type History } from "@/lib/runtime/agent";
import { liveBackends } from "@/lib/runtime/live";
import { admin } from "@/lib/supabase-admin";

export const maxDuration = 120;

const TTS_MODEL = "gemini-3.8-flash-tts";

async function speak(engagementId: string, reply: string): Promise<string | null> {
  const text = reply.replace(/[*_#`>]/g, "").replace(/^\s*-\s+/gm, "");
  const res = await gemini(TTS_MODEL, {
    contents: [{ parts: [{ text: `### DIRECTOR'S NOTES\nStyle: warm, efficient assistant.\n\n### TRANSCRIPT\n${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } },
    },
  });
  const data = audioOf(res);
  if (!data) return null;
  const path = `engagements/${engagementId}/${crypto.randomUUID()}.wav`;
  const bucket = admin().storage.from("audio");
  const { error } = await bucket.upload(path, pcmToWav(Buffer.from(data, "base64")), {
    contentType: "audio/wav",
    upsert: true,
  });
  if (error) throw new Error(`audio upload failed: ${error.message}`);
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { text?: string; voice?: boolean } | null;
  const text = body?.text?.trim();
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });

  const db = admin();
  const { data: eng } = await db.from("engagements").select("id, agent_id, status").eq("id", id).maybeSingle();
  if (!eng) return Response.json({ error: "engagement not found" }, { status: 404 });
  if (eng.status !== "active") return Response.json({ error: "engagement is not active" }, { status: 409 });
  const { data: agent } = await db.from("market_agents").select("*").eq("id", eng.agent_id).single();
  if (!agent) return Response.json({ error: "agent not found" }, { status: 404 });

  const { data: past } = await db
    .from("engagement_messages")
    .select("from, text")
    .eq("engagement_id", id)
    .in("from", ["user", "agent"])
    .order("created_at", { ascending: false })
    .limit(12);
  const history: History = (past ?? [])
    .reverse()
    .map((m) => ({ role: m.from === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));

  await db.from("engagement_messages").insert({ engagement_id: id, from: "user", text });

  const actions: unknown[] = [];
  const backends = await liveBackends();
  const { reply } = await runAgent(
    agent as MarketAgent,
    text,
    backends,
    async (step) => {
      if (step.kind !== "tool") return;
      // A failed meter call must never break the conversation; the action row still records the work.
      const meter_event = await meterAction(id).then(
        (m) => m.meter_event,
        () => null,
      );
      const action = { name: step.name, input: step.input, output: step.output, meter_event };
      actions.push(action);
      await db.from("engagement_messages").insert({ engagement_id: id, from: "action", text: step.name, action });
    },
    history,
  );

  const audio_url = body?.voice ? await speak(id, reply).catch(() => null) : null;
  await db.from("engagement_messages").insert({ engagement_id: id, from: "agent", text: reply || "(no reply)", audio_url });
  return Response.json({ reply, audio_url, actions });
}
