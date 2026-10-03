import { POST as startRunRoute } from "@/app/api/run/route";
import { GET as scorecardRoute } from "@/app/api/scorecard/route";
import { cardById } from "@/lib/agents/cards";
import { auditionJob, hire } from "@/lib/agents/pipeline";
import { admin } from "@/lib/supabase-admin";
import type { Audition, Job, Payment, Run, RunMode, Skill } from "@/lib/types";

// What the MCP tools do. Each call reuses a route or the pipeline in process, never over HTTP.

export class ToolError extends Error {}

function internal(path: string, init: RequestInit) {
  return new Request(`http://blast.internal${path}`, init);
}

async function readJson(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ToolError(String(body?.error ?? `request failed with ${res.status}`).slice(0, 200));
  return body;
}

export async function findAgents(skill: Skill) {
  return readJson(await scorecardRoute(internal(`/api/scorecard?skill=${skill}`, { method: "GET" })));
}

export async function startRun(goal: string, mode: RunMode) {
  const body = await readJson(
    await startRunRoute(
      internal("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal, mode }),
      }),
    ),
  );
  const jobs = (body.jobs ?? []) as Job[];
  return {
    run_id: body.run.id as string,
    status: body.run.status as string,
    mode,
    jobs: jobs.map((job) => ({ job_id: job.id, skill: job.skill, brief: job.brief, order: job.order })),
  };
}

export async function getRun(runId: string) {
  const db = admin();
  const { data: run, error } = await db.from("runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!run) throw new ToolError("run not found");

  const { data: jobRows } = await db.from("jobs").select("*").eq("run_id", runId);
  const jobs = ((jobRows ?? []) as Job[]).sort((a, b) => a.order - b.order);
  const { data: auditionRows } = jobs.length
    ? await db.from("auditions").select("*").in("job_id", jobs.map((job) => job.id))
    : { data: [] };
  const auditions = (auditionRows ?? []) as Audition[];
  const { data: paymentRows } = await db.from("payments").select("*").eq("run_id", runId);
  const payments = (paymentRows ?? []) as Payment[];

  const payouts = payments.filter((p) => p.status !== "failed").reduce((sum, p) => sum + p.amount_cents, 0);
  const typed = run as Run;

  return {
    run_id: typed.id,
    goal: typed.goal,
    mode: typed.mode,
    status: typed.status,
    budget_cents: typed.budget_cents,
    price_cents: typed.price_cents,
    jobs: jobs.map((job) => ({
      job_id: job.id,
      skill: job.skill,
      brief: job.brief,
      status: job.status,
      winner: job.winner_agent_id ? (cardById(job.winner_agent_id)?.name ?? job.winner_agent_id) : null,
      output_text: job.output_text,
      audio_url: job.audio_url,
      auditions: auditions
        .filter((a) => a.job_id === job.id && a.status !== "skipped")
        .sort((a, b) => Number(b.score ?? -1) - Number(a.score ?? -1))
        .map((a) => ({
          agent_id: a.agent_id,
          agent: cardById(a.agent_id)?.name ?? a.agent_id,
          status: a.status,
          score: a.score === null ? null : Number(a.score),
          reason: a.reason,
          output_text: a.output_text,
          audio_url: a.audio_url,
        })),
    })),
    winners: jobs
      .filter((job) => job.winner_agent_id)
      .map((job) => ({ skill: job.skill, agent_id: job.winner_agent_id, agent: cardById(job.winner_agent_id!)?.name })),
    outputs: jobs
      .filter((job) => job.status === "done")
      .map((job) => ({ skill: job.skill, output_text: job.output_text, audio_url: job.audio_url })),
    payments: payments.map((p) => ({
      agent_id: p.agent_id,
      agent: cardById(p.agent_id)?.name ?? p.agent_id,
      amount_cents: p.amount_cents,
      status: p.status,
      stripe_id: p.stripe_id,
    })),
    margin_cents: typed.price_cents - payouts,
  };
}

export async function hireRun(runId: string) {
  const result = await hire({ run_id: runId });
  if (result.status !== 200) throw new ToolError(String(result.body.error ?? "hire failed"));
  return getRun(runId);
}

// The same rule as auto mode in the run route: hire when the best agents fit the budget.
async function fitsBudget(runId: string) {
  const run = await getRun(runId);
  const total = run.jobs.reduce((sum, job) => {
    const best = job.auditions
      .filter((a) => a.status === "scored")
      .map((a) => ({ score: a.score ?? 0, price: cardById(a.agent_id)?.price_cents ?? 0 }))
      .sort((a, b) => b.score - a.score || a.price - b.price)[0];
    return sum + (best?.price ?? 0);
  }, 0);
  return total > 0 && total <= run.budget_cents;
}

const POLL_MS = 2_000;
const POLL_CAP_MS = 150_000;

// The run route starts auditions only after its response is sent, and inside this tool call
// that response never ends while we wait. So the auditions and the auto hire run here; the
// route's own after() then finds them done and does nothing.
export async function hireForGoal(goal: string) {
  const started = Date.now();
  const run = await startRun(goal, "auto");
  await Promise.allSettled(run.jobs.map((job) => auditionJob(job.job_id)));
  if (await fitsBudget(run.run_id)) await hire({ run_id: run.run_id });

  let state = await getRun(run.run_id);
  while (state.status !== "done" && state.status !== "waiting" && Date.now() - started < POLL_CAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    state = await getRun(run.run_id);
  }

  const note =
    state.status === "done"
      ? "Done. The agents were hired and paid."
      : state.status === "waiting"
        ? `Waiting: the best agents cost more than the budget, or a hire failed. Call hire with run_id ${state.run_id} to hire them anyway.`
        : `Still ${state.status} after ${Math.round(POLL_CAP_MS / 1000)} s. Call get_run with run_id ${state.run_id} to check again.`;
  return { note, seconds: Math.round((Date.now() - started) / 1000), ...state };
}
