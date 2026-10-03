// Vercel AI Gateway, OpenAI-compatible chat endpoint. Plain REST, like gemini.ts.

const URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

type ChatResponse = { choices?: { message?: { content?: string } }[] };

export async function gatewayText(
  model: string,
  system: string,
  prompt: string,
  timeoutMs = 30_000,
): Promise<string> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) throw new Error("AI_GATEWAY_API_KEY is missing");
  const res = await fetch(URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gateway ${model} ${res.status}: ${detail.slice(0, 200)}`);
  }
  const body: ChatResponse = await res.json();
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}
