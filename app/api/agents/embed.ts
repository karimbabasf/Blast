// Meaning vectors for the agent registry. Must match the vector(768) column in public.agents.

const URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

export const EMBED_DIM = 768;

type Task = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";

export async function embed(text: string, task: Task): Promise<number[]> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
  const res = await fetch(URL, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: task,
      outputDimensionality: EMBED_DIM,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding ${res.status}: ${detail.slice(0, 200)}`);
  }
  const body: { embedding?: { values?: number[] } } = await res.json();
  const values = body.embedding?.values;
  if (values?.length !== EMBED_DIM) throw new Error("Embedding came back empty");
  return values;
}

// What a builder's agent is, in the words a business would search with.
export function agentText(agent: { name: string; skills: string[]; description: string }) {
  return `${agent.name}. ${agent.skills.join(", ")} agent. ${agent.description}`;
}
