import { withRetry } from "@/lib/agents/retry";
import type { JobRequest, JobResult, Verdict } from "@/lib/types";
import {
  AUDIO_PROMPT,
  audioVerdict,
  clampScore,
  fetchAudio,
  judgeText,
  listenAudio,
  shortLine,
  textPrompt,
} from "./index";

// A panel of judges from different labs. A judge never grades its own lab's model when another can.

type Lab = "anthropic" | "openai" | "google";
type Ballot = Verdict & { judge: string; name_right?: boolean };
type Judge = { name: string; lab: Lab; run: () => Promise<Ballot> };

const TIMEOUT_MS = 20_000;
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const AUDIO_MODEL = "gpt-audio-1.5";

const LABS: Record<string, Lab> = {
  "script-quill": "anthropic",
  "script-mara": "anthropic",
  "script-dex": "google",
  "voice-aria": "google",
  "voice-bram": "google",
  "voice-kit": "google",
};

const JSON_REPLY =
  'Reply with only a JSON object: {"score": number, "reason": string}. No other text.';
const AUDIO_JSON_REPLY =
  'Reply with only a JSON object: {"heard": string, "name_right": boolean, "score": number, "reason": string}. No other text.';

type ChatResponse = { choices?: { message?: { content?: string } }[] };

async function chat(
  url: string,
  key: string | undefined,
  body: object,
  label: string,
): Promise<string> {
  if (!key) throw new Error(`${label} has no API key`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${label} ${res.status}: ${detail.slice(0, 200)}`);
  }
  const reply: ChatResponse = await res.json();
  const text = reply.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${label} gave an empty reply`);
  return text;
}

// Models wrap JSON in fences or a sentence now and then, so take the outermost braces.
function parseJson<T>(raw: string, label: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`${label} sent no JSON`);
  const v = JSON.parse(raw.slice(start, end + 1)) as T & { score: unknown };
  if (typeof v.score !== "number" && typeof v.score !== "string")
    throw new Error(`${label} sent no score`);
  return v;
}

function gatewayJudge(name: string, lab: Lab, model: string, prompt: string): Judge {
  return {
    name,
    lab,
    run: () =>
      withRetry(async () => {
        const raw = await chat(
          GATEWAY_URL,
          process.env.AI_GATEWAY_API_KEY,
          {
            model,
            messages: [{ role: "user", content: `${prompt}\n\n${JSON_REPLY}` }],
            // GPT-5 models only take the default temperature.
            ...(lab === "openai" ? {} : { temperature: 0 }),
          },
          `${name} judge`,
        );
        const v = parseJson<Verdict>(raw, `${name} judge`);
        return {
          judge: name,
          score: clampScore(Number(v.score)),
          reason: shortLine(String(v.reason ?? "")),
        };
      }),
  };
}

function textJudges(req: JobRequest, text: string): Judge[] {
  const prompt = textPrompt(req, text);
  return [
    gatewayJudge("GPT", "openai", "openai/gpt-5-mini", prompt),
    {
      name: "Gemini",
      lab: "google",
      run: async () => ({
        judge: "Gemini",
        ...(await judgeText(req, text, TIMEOUT_MS)),
      }),
    },
    gatewayJudge("Claude", "anthropic", "anthropic/claude-sonnet-5.5", prompt),
  ];
}

function audioJudges(audio: Promise<string>): Judge[] {
  return [
    {
      name: "GPT",
      lab: "openai",
      run: async () => {
        const data = await audio;
        return withRetry(async () => {
          const raw = await chat(
            OPENAI_URL,
            process.env.OPENAI_API_KEY,
            {
              model: AUDIO_MODEL,
              modalities: ["text"],
              temperature: 0,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: `${AUDIO_PROMPT}\n\n${AUDIO_JSON_REPLY}` },
                    { type: "input_audio", input_audio: { data, format: "wav" } },
                  ],
                },
              ],
            },
            "GPT ear",
          );
          const v = parseJson<Verdict & { heard: string; name_right: boolean }>(
            raw,
            "GPT ear",
          );
          const name_right = v.name_right === true;
          return {
            judge: "GPT",
            name_right,
            ...audioVerdict({ ...v, score: Number(v.score), name_right }),
          };
        });
      },
    },
    {
      name: "Gemini",
      lab: "google",
      run: async () => {
        const v = await listenAudio(await audio);
        // A right name always scores 6 or more and a wrong one 3 or less, so the score tells which.
        return { judge: "Gemini", name_right: v.score > 3, ...v };
      },
    },
  ];
}

// The two judges whose lab differs from the candidate's, topped up from the rest if needed.
function pickTwo(judges: Judge[], lab: Lab | undefined): Judge[] {
  const others = judges.filter((j) => j.lab !== lab);
  return [...others, ...judges.filter((j) => j.lab === lab)].slice(0, 2);
}

export async function judgePanel(
  req: JobRequest,
  result: JobResult,
): Promise<Verdict & { ballots: Ballot[] }> {
  let judges: Judge[];
  if (result.kind === "audio") {
    if (!result.audio_url)
      throw new Error(`no audio to judge from ${result.agent_id}`);
    const audio = fetchAudio(result.audio_url);
    // Stops an unhandled rejection when every judge fails before awaiting it.
    audio.catch(() => undefined);
    judges = audioJudges(audio);
  } else {
    if (!result.text)
      throw new Error(`no text to judge from ${result.agent_id}`);
    judges = pickTwo(textJudges(req, result.text), LABS[result.agent_id]);
  }

  const settled = await Promise.allSettled(judges.map((j) => j.run()));
  const ballots = settled.flatMap((s) =>
    s.status === "fulfilled" ? [s.value] : [],
  );
  if (!ballots.length) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof Error
      ? first.reason
      : new Error("every judge failed");
  }

  const mean = ballots.reduce((sum, b) => sum + b.score, 0) / ballots.length;
  const wrongName = ballots.find((b) => b.name_right === false);
  const score = clampScore(wrongName ? Math.min(3, mean) : mean);
  const why = wrongName ?? [...ballots].sort((a, b) => a.score - b.score)[0];
  const tally = ballots.map((b) => `${b.judge} ${b.score}`).join(" · ");
  return { score, reason: shortLine(`${tally}: ${why.reason}`), ballots };
}
