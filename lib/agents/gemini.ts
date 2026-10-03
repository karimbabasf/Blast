// Plain REST calls to the Gemini API. No SDK, so nothing to break.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const TEXT_MODEL = "gemini-3.8-flash";
export const LITE_MODEL = "gemini-3.5-flash-lite";

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

export type GeminiResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
};

export async function gemini(
  model: string,
  body: unknown,
  timeoutMs = 45_000,
): Promise<GeminiResponse> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${model} ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export function textOf(res: GeminiResponse): string {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

export function audioOf(res: GeminiResponse): string | null {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.find((p) => p.inlineData?.data)?.inlineData?.data ?? null;
}
