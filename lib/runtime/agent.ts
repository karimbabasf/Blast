// The tool loop every market agent runs on: AI Gateway chat completions with OpenAI-style tools.

import type { MarketAgent } from "@/lib/market/types";
import { callTool, toolsFor, type Backends } from "@/lib/roles";
import { nowLine } from "@/lib/roles/seed";

const URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MAX_TURNS = 10;
const BUDGET_MS = 90_000;

export type Step = { kind: "tool" | "say"; name: string; input: unknown; output: unknown };

// Tokens and the list-price cost of a run, to set beside the specialist's flat price.
export type Usage = { input_tokens: number; output_tokens: number; cost_usd: number };
const PER_MTOK: Record<string, [number, number]> = {
  "anthropic/claude-sonnet-5.5": [3, 15],
  "anthropic/claude-haiku-4.5": [1, 5],
  "openai/gpt-5-mini": [0.25, 2],
  "google/gemini-3.8-flash": [0.3, 2.5],
  "google/gemini-3.5-flash-lite": [0.1, 0.4],
};

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ChatResponse = {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export type History = { role: "user" | "assistant"; content: string }[];

export async function runAgent(
  agent: MarketAgent,
  task: string,
  backends: Backends,
  onStep: (step: Step) => Promise<void>,
  history: History = [],
): Promise<{ reply: string; tools: number; usage: Usage }> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) throw new Error("AI_GATEWAY_API_KEY is missing");
  const tools = toolsFor(agent.role, agent.tools);
  const messages: Message[] = [
    {
      role: "system",
      content: agent.role === "calendar" || agent.role === "email"
        ? `${agent.system_prompt}\n\n${nowLine()} The business is Xochitl Coffee.`
        : agent.system_prompt,
    },
    ...history,
    { role: "user", content: task },
  ];
  const deadline = Date.now() + BUDGET_MS;
  let toolCount = 0;
  const usage: Usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  const [inRate, outRate] = PER_MTOK[agent.model] ?? [3, 15];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error("ran out of time (90 s)");
    const res = await fetch(URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: agent.model, messages, tools, tool_choice: "auto" }),
      signal: AbortSignal.timeout(left),
    });
    if (!res.ok) throw new Error(`Gateway ${agent.model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as ChatResponse;
    usage.input_tokens += body.usage?.prompt_tokens ?? 0;
    usage.output_tokens += body.usage?.completion_tokens ?? 0;
    usage.cost_usd = (usage.input_tokens * inRate + usage.output_tokens * outRate) / 1e6;
    const msg = body.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];
    if (!calls.length) {
      const reply = (msg?.content ?? "").trim();
      await onStep({ kind: "say", name: "reply", input: null, output: reply });
      return { reply, tools: toolCount, usage };
    }
    messages.push({ role: "assistant", content: msg?.content ?? null, tool_calls: calls });
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      let output: unknown;
      try {
        args = JSON.parse(call.function.arguments || "{}");
        output = await callTool(call.function.name, args, backends);
      } catch (err) {
        output = { error: err instanceof Error ? err.message : String(err) };
      }
      toolCount++;
      await onStep({ kind: "tool", name: call.function.name, input: args, output });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }
  const reply = "Stopped after 10 turns without a final answer.";
  await onStep({ kind: "say", name: "reply", input: null, output: reply });
  return { reply, tools: toolCount, usage };
}
