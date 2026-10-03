import type { AgentCard, JobRequest, JobResult, Verdict } from "@/lib/types";

// Canned results for BLAST_FAKE=1. Same texts and scores as the UI's chunk 1 data.

type FakeSample = { text: string; score: number; reason: string };

const SAMPLES: Record<string, FakeSample> = {
  "script-quill": {
    text: "Mornings start at Xochitl Coffee. Fresh roast, warm pastries, two blocks from the plaza. Xochitl Coffee. Come taste the sunrise.",
    score: 9,
    reason: "Names the shop twice and lands the call to action in 15 seconds.",
  },
  "script-mara": {
    text: "My grandmother said the best days begin slowly, with a cup made by someone who knows your name. At Xochitl Coffee, we still believe that...",
    score: 7,
    reason: "Charming, but it runs long for 15 seconds.",
  },
  "script-dex": {
    text: "Coffee. Good. Xochitl.",
    score: 4,
    reason: "Too short. Never says where the shop is or what to do.",
  },
  "voice-aria": {
    text: "Wake up at SO-cheel Coffee.",
    score: 9,
    reason: "Warm and clear. Says Xochitl correctly.",
  },
  "voice-bram": {
    text: "Wake up at SO-cheel Coffee.",
    score: 7,
    reason: "Clear, but low energy for a morning ad.",
  },
  "voice-kit": {
    text: "Wake up at Zo-CHIT-ul Coffee.",
    score: 2,
    reason: "Says the shop name wrong.",
  },
};

function sampleFor(agentId: string): FakeSample {
  const sample = SAMPLES[agentId];
  if (!sample) throw new Error(`no fake sample for ${agentId}`);
  return sample;
}

function pause() {
  return new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1700));
}

export async function fakeRun(card: AgentCard, req: JobRequest): Promise<JobResult> {
  const sample = sampleFor(card.id);
  await pause();
  if (req.skill === "voice") {
    return { agent_id: card.id, kind: "audio", text: req.sample ? sample.text : req.input_text };
  }
  return { agent_id: card.id, kind: "text", text: sample.text };
}

export async function fakeJudge(result: JobResult): Promise<Verdict> {
  const { score, reason } = sampleFor(result.agent_id);
  await pause();
  return { score, reason };
}
