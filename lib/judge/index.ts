import { gemini, TEXT_MODEL, textOf } from "@/lib/agents/gemini";
import { withRetry } from "@/lib/agents/retry";
import type { JobRequest, JobResult, Verdict } from "@/lib/types";

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

const VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "NUMBER" },
    reason: { type: "STRING" },
  },
  required: ["score", "reason"],
};

// The audio judge writes down what it heard before it scores, so it cannot just assume the name was right.
const AUDIO_SCHEMA = {
  type: "OBJECT",
  properties: {
    heard: { type: "STRING" },
    name_right: { type: "BOOLEAN" },
    score: { type: "NUMBER" },
    reason: { type: "STRING" },
  },
  required: ["heard", "name_right", "score", "reason"],
  propertyOrdering: ["heard", "name_right", "score", "reason"],
};

export const AUDIO_PROMPT = `You judge a voice audition for a morning radio ad for a coffee shop named Xochitl.
"Xochitl" is a Nahuatl name, said "SO-cheel". Right: it starts with an S or SH sound, then "o", then a "chee" or "chi" sound.
Small differences at the end are fine: "SO-cheel", "SO-chil", "SO-cheet", "SHO-cheel", "SO-chee" are all right.
Wrong: it starts with a Z, X or "Ex" sound, it has a hard K, or it ends in "cho". For example "ZO-chit-ul", "ZOH-chittle", "EX-o-chitl", "zo-KIT-ul", "SAH-cho".
Listen closely to the clip. First write in "heard" exactly how the speaker said the shop name, spelled out by sound.
Then set name_right from what you wrote in "heard", using the rules above.
Then score the clip. Saying the name right matters most:
- name_right true: score 6 to 10, higher for clear words and morning radio energy.
- name_right false: score 0 to 3, however good the voice is.
reason: one short line in plain words, under 90 characters. If the name was wrong, say the name was said wrong.`;

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

export function shortLine(s: string): string {
  const line = s.replace(/\s+/g, " ").trim();
  return line.length < 100 ? line : `${line.slice(0, 96).trimEnd()}...`;
}

async function ask<T>(
  parts: Part[],
  schema: object,
  timeoutMs = 45_000,
): Promise<T> {
  return withRetry(async () => {
    const res = await gemini(
      TEXT_MODEL,
      {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      },
      timeoutMs,
    );
    const raw = textOf(res);
    if (!raw) throw new Error("judge got an empty reply");
    return JSON.parse(raw) as T;
  });
}

// The text rubric, shared with the cross-lab panel so every judge reads the same task.
export function textPrompt(req: JobRequest, text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  const task = req.sample
    ? `This is an audition sample: the opening hook of a radio ad for Xochitl Coffee.
Score 0 to 10 on how well it grabs a morning listener in the first seconds.`
    : `This is the full script for a 15 second radio ad for Xochitl Coffee.
It must name the shop "Xochitl Coffee" and fit about 15 seconds, which is 30 to 38 spoken words.
It has ${words} words. Missing the shop name caps the score at 3. Far outside 30 to 38 words loses points.`;
  return `You judge copy for a radio ad. ${task}
reason: one short line in plain words, under 90 characters.

Script:
"""${text}"""`;
}

export async function judgeText(
  req: JobRequest,
  text: string,
  timeoutMs?: number,
): Promise<Verdict> {
  const v = await ask<Verdict>(
    [{ text: textPrompt(req, text) }],
    VERDICT_SCHEMA,
    timeoutMs,
  );
  return { score: clampScore(v.score), reason: shortLine(v.reason) };
}

export async function fetchAudio(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`judge could not fetch audio: ${res.status}`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function judgeAudio(url: string): Promise<Verdict> {
  return listenAudio(await fetchAudio(url));
}

export async function listenAudio(data: string): Promise<Verdict> {
  // One listen can mishear a borderline name, so listen three times at once and take the median.
  const listens = await Promise.allSettled(
    [0, 1, 2].map(() =>
      ask<Verdict & { heard: string; name_right: boolean }>(
        [
          { text: AUDIO_PROMPT },
          { inlineData: { mimeType: "audio/wav", data } },
        ],
        AUDIO_SCHEMA,
        20_000,
      ),
    ),
  );
  const verdicts = listens
    .flatMap((l) => (l.status === "fulfilled" ? [l.value] : []))
    .map(audioVerdict)
    .sort((a, b) => a.score - b.score);
  if (!verdicts.length) {
    const first = listens[0] as PromiseRejectedResult;
    throw first.reason instanceof Error
      ? first.reason
      : new Error("judge failed to listen");
  }
  return verdicts[Math.floor((verdicts.length - 1) / 2)];
}

export function audioVerdict(
  v: Verdict & { heard: string; name_right: boolean },
): Verdict {
  if (v.name_right)
    return {
      score: Math.max(6, clampScore(v.score)),
      reason: shortLine(v.reason),
    };
  const reason = /wrong/i.test(v.reason)
    ? v.reason
    : `Said the name wrong: "${v.heard}".`;
  return { score: Math.min(3, clampScore(v.score)), reason: shortLine(reason) };
}

export async function judge(
  req: JobRequest,
  result: JobResult,
): Promise<Verdict> {
  if (result.kind === "audio") {
    if (!result.audio_url)
      throw new Error(`no audio to judge from ${result.agent_id}`);
    return judgeAudio(result.audio_url);
  }
  if (!result.text) throw new Error(`no text to judge from ${result.agent_id}`);
  return judgeText(req, result.text);
}
