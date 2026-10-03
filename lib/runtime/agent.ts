// The tool loop every market agent runs on: AI Gateway chat completions with OpenAI-style tools.

import type { MarketAgent } from "@/lib/market/types";
import { callTool, toolsFor, type Backends } from "@/lib/roles";
import { nowLine } from "@/lib/roles/seed";

const URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const MAX_TURNS = 10;
const BUDGET_MS = 60_000;

export type Step = { kind: "tool" | "say"; name: string; input: unknown; output: unknown };

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ChatResponse = { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };

export type History = { role: "user" | "assistant"; content: string }[];

export async function runAgent(
  agent: MarketAgent,
  task: string,
  backends: Backends,
  onStep: (step: Step) => Promise<void>,
  history: History = [],
): Promise<{ reply: string; tools: number }> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) throw new Error("AI_GATEWAY_API_KEY is missing");
  const tools = toolsFor(agent.role, agent.tools);
  const messages: Message[] = [
    { role: "system", content: `${agent.system_prompt}\n\n${nowLine()} The business is Xochitl Coffee.` },
    ...history,
    { role: "user", content: task },
  ];
  const deadline = Date.now() + BUDGET_MS;
  let toolCount = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error("ran out of time (60 s)");
    const res = await fetch(URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: agent.model, messages, tools, tool_choice: "auto" }),
      signal: AbortSignal.timeout(left),
    });
    if (!res.ok) throw new Error(`Gateway ${agent.model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const msg = ((await res.json()) as ChatResponse).choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];
    if (!calls.length) {
      const reply = (msg?.content ?? "").trim();
      await onStep({ kind: "say", name: "reply", input: null, output: reply });
      return { reply, tools: toolCount };
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
  return { reply, tools: toolCount };
}
