// Tryouts: every candidate runs the role's test task on its own fresh world, in parallel, live.

import type { Check, MarketAgent, Need, Role } from "@/lib/market/types";
import { TASKS, checksFor } from "@/lib/roles";
import { SCRIPTED_ROLES, scriptFor, designPage } from "@/lib/roles/scripted";
import { createWorld, worldCalendar, worldMail } from "@/lib/roles/world";
import { admin } from "@/lib/supabase-admin";
import { runAgent, type Step, type Usage } from "./agent";

type Lab = "anthropic" | "openai" | "google";
const JUDGES: { lab: Lab; model: string }[] = [
  { lab: "anthropic", model: "anthropic/claude-sonnet-5.5" },
  { lab: "openai", model: "openai/gpt-5-mini" },
  { lab: "google", model: "google/gemini-3.8-flash" },
];

const labOf = (model: string) => model.split("/")[0] as Lab;

// No temperature: GPT-5 models only take the default.
async function ask(model: string, prompt: string): Promise<string> {
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`judge ${model} ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? "";
}

// Two judges from labs other than the candidate's. Average of the ones that answer, 0 to 10.
async function judge(agent: MarketAgent, task: string, steps: Step[], reply: string): Promise<{ score: number; reason: string } | null> {
  const panel = JUDGES.filter((j) => j.lab !== labOf(agent.model)).slice(0, 2);
  const log = steps
    .map((s, i) => `${i + 1}. ${s.name} ${JSON.stringify(s.input)} -> ${JSON.stringify(s.output).slice(0, 400)}`)
    .join("\n");
  const prompt = `An agent was given this job on a private test copy:\n${task}\n\nIts tool calls, in order:\n${log}\n\nIts final reply to the business:\n${reply}\n\nScore 0 to 10 how well it did the job: correct actions, no harmful side effects, sensible use of tools, a clear honest reply. Reply with only a JSON object: {"score": number, "reason": string}.`;
  const settled = await Promise.allSettled(
    panel.map(async (j) => {
      const raw = await ask(j.model, prompt);
      const v = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { score: unknown; reason: unknown };
      return { score: Math.max(0, Math.min(10, Number(v.score))), reason: String(v.reason ?? "") };
    }),
  );
  const ok = settled.flatMap((s) => (s.status === "fulfilled" && Number.isFinite(s.value.score) ? [s.value] : []));
  if (!ok.length) return null;
  return {
    score: ok.reduce((a, v) => a + v.score, 0) / ok.length,
    reason: ok[0].reason.slice(0, 240),
  };
}

const passedShare = (checks: Check[]) => (checks.length ? checks.filter((c) => c.passed).length / checks.length : 0);

// Specialists audition on the caller's actual job; calendar and email ones on a fixed task in a copy.
const ON_THE_JOB = new Set<Role>(["auto_repair", "medical_billing", "web_design"]);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A scripted tryout streams its fixed steps at a human pace, hands in its work, and scores itself.
async function runScripted(tryoutId: string, agent: MarketAgent, worldId: string, job: string): Promise<boolean> {
  const script = scriptFor(agent.id, job);
  if (!script) return false;
  const db = admin();
  await wait(400 + Math.random() * 500);
  for (const [i, step] of script.steps.entries()) {
    await wait(700 + Math.random() * 700);
    await Promise.all([
      db.from("tryout_steps").insert({ tryout_id: tryoutId, n: i + 1, kind: "tool", ...step }),
      db.from("tryouts").update({ steps: i + 1 }).eq("id", tryoutId),
    ]);
  }
  await db.from("tryout_steps").insert({ tryout_id: tryoutId, n: script.steps.length + 1, kind: "say", name: "reply", input: null, output: script.reply });
  if (agent.id === "design-ines") await db.from("world_outputs").insert({ world_id: worldId, kind: "design", body: designPage(job) });
  const share = script.checks.filter((c) => c.passed).length / script.checks.length;
  await wait(500);
  await db
    .from("tryouts")
    .update({
      status: "scored",
      score: Math.round((7 * share + 3 * (script.judge / 10)) * 10) / 10,
      checks: script.checks,
      reason: script.reason,
      steps: script.steps.length,
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: script.cost_usd },
    })
    .eq("id", tryoutId);
  return true;
}

async function runOne(tryoutId: string, agent: MarketAgent, role: Role, jobText: string): Promise<void> {
  const db = admin();
  const task = ON_THE_JOB.has(role) ? jobText : TASKS[role];
  if (!task) throw new Error(`role ${role} has no test task`);
  const worldId = await createWorld(tryoutId);
  if (SCRIPTED_ROLES.has(role) && (await runScripted(tryoutId, agent, worldId, jobText))) return;
  const steps: Step[] = [];
  let toolSteps = 0;
  const onStep = async (step: Step) => {
    steps.push(step);
    if (step.kind === "tool") toolSteps++;
    await Promise.all([
      db.from("tryout_steps").insert({ tryout_id: tryoutId, n: steps.length, ...step }),
      db.from("tryouts").update({ steps: toolSteps }).eq("id", tryoutId),
    ]);
  };
  let reply = "";
  let usage: Usage | null = null;
  let runError: string | null = null;
  try {
    const run = await runAgent(
      agent,
      task,
      { calendar: worldCalendar(worldId), mail: worldMail(worldId), worldId, builder: agent.builder },
      onStep,
    );
    reply = run.reply;
    usage = run.usage;
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err);
  }
  const checks = await checksFor(role, worldId, task);
  // Work already handed in still counts when the agent ran out of time before its final reply.
  if (runError && !checks[0]?.passed) {
    await db.from("tryouts").update({ status: "failed", checks, reason: runError, steps: toolSteps }).eq("id", tryoutId);
    return;
  }
  const verdict = await judge(agent, task, steps, reply);
  const share = passedShare(checks);
  // When no judge answers, the checks carry the whole score, so a passing agent can still win.
  const judged = verdict ? verdict.score : share * 10;
  const score = Math.round((7 * share + 3 * (judged / 10)) * 10) / 10;
  const failed = checks.filter((c) => !c.passed).map((c) => c.name);
  const reason = [
    failed.length ? `Failed: ${failed.join("; ")}.` : "All checks passed.",
    verdict ? `Judges ${verdict.score.toFixed(1)}/10: ${verdict.reason}` : "Judges did not answer; scored on checks alone.",
  ].join(" ");
  await db
    .from("tryouts")
    .update({ status: "scored", score, checks, reason, steps: toolSteps, usage })
    .eq("id", tryoutId);
}

// Creates one running tryout per agent and returns their ids; run them with runTryouts.
export async function createTryouts(need: Need, agents: MarketAgent[]): Promise<{ id: string; agent_id: string }[]> {
  if (!agents.length) return [];
  const { data, error } = await admin()
    .from("tryouts")
    .insert(agents.map((a) => ({ need_id: need.id, agent_id: a.id })))
    .select("id, agent_id");
  if (error) throw new Error(`tryout insert failed: ${error.message}`);
  return data;
}

export async function runTryouts(
  need: Need,
  agents: MarketAgent[],
  tryouts: { id: string; agent_id: string }[],
  after: Need["status"] = "waiting",
): Promise<void> {
  const db = admin();
  await Promise.allSettled(
    tryouts.map(async (t) => {
      const agent = agents.find((a) => a.id === t.agent_id);
      if (!agent) return;
      try {
        await runOne(t.id, agent, need.role, need.text);
      } catch (err) {
        await db
          .from("tryouts")
          .update({ status: "failed", reason: err instanceof Error ? err.message : String(err) })
          .eq("id", t.id);
      }
    }),
  );
  await db.from("needs").update({ status: after }).eq("id", need.id);
}
