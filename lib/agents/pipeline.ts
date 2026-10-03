import { loadCards } from "@/lib/agents/cards";
import { judgeResult, runAgent } from "@/lib/agents";
import { pay } from "@/lib/pay";
import { admin } from "@/lib/supabase-admin";
import {
  AUDITION_VOICE_LINE,
  type AgentCard,
  type Audition,
  type Job,
  type JobRequest,
  type JobResult,
} from "@/lib/types";

// The audition and hire steps, shared by their routes and the paid agent endpoint.

export type PipelineResult = { status: number; body: Record<string, unknown> };

class HireError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function shortError(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 100);
}

function clampScore(score: number) {
  return Math.round(Math.min(10, Math.max(0, Number(score) || 0)) * 10) / 10;
}

async function audition(job: Job, row: Audition, cards: AgentCard[]) {
  const db = admin();
  try {
    const card = cards.find((c) => c.id === row.agent_id);
    if (!card) throw new Error(`unknown agent ${row.agent_id}`);
    const req: JobRequest = {
      job_id: job.id,
      skill: job.skill,
      brief: job.brief,
      sample: true,
      ...(job.skill === "voice" ? { input_text: AUDITION_VOICE_LINE } : {}),
    };
    const result = await runAgent(card, req);
    await db
      .from("auditions")
      .update({ output_text: result.text ?? null, audio_url: result.audio_url ?? null })
      .eq("id", row.id);
    const verdict = await judgeResult(req, result);
    await db
      .from("auditions")
      .update({ score: clampScore(verdict.score), reason: verdict.reason, status: "scored" })
      .eq("id", row.id);
  } catch (err) {
    await db
      .from("auditions")
      .update({ status: "failed", reason: shortError(err) })
      .eq("id", row.id);
  }
}

export async function auditionJob(jobId: string): Promise<PipelineResult> {
  const db = admin();
  const { data: job, error } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!job) return { status: 404, body: { error: "job not found" } };

  const cards = await loadCards();
  const rows = cards.map((card) => {
    const hasSkill = card.skills.includes(job.skill);
    const plays = hasSkill && card.real;
    return {
      job_id: jobId,
      agent_id: card.id,
      status: plays ? "running" : "skipped",
      skip_reason: plays ? null : hasSkill ? "Not available" : "Wrong skill",
    };
  });

  // The unique (job_id, agent_id) key makes a second call a no-op: it inserts nothing and runs nothing.
  const { data: inserted, error: insertError } = await db
    .from("auditions")
    .upsert(rows, { onConflict: "job_id,agent_id", ignoreDuplicates: true })
    .select();
  if (insertError) return { status: 500, body: { error: insertError.message } };

  if (inserted?.length) {
    const running = inserted.filter((row: Audition) => row.status === "running");
    await Promise.allSettled(running.map((row: Audition) => audition(job as Job, row, cards)));

    await db.from("jobs").update({ status: "waiting" }).eq("id", jobId).eq("status", "auditioning");
    const { data: jobs } = await db.from("jobs").select("status").eq("run_id", job.run_id);
    if (jobs?.length && jobs.every((j) => j.status === "waiting")) {
      await db.from("runs").update({ status: "waiting" }).eq("id", job.run_id);
    }
  }

  const { data: auditions } = await db.from("auditions").select("*").eq("job_id", jobId);
  return { status: 200, body: { auditions: auditions ?? [] } };
}

async function loadJob(jobId: string): Promise<Job> {
  const { data, error } = await admin().from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw new HireError(error.message, 500);
  if (!data) throw new HireError("job not found", 404);
  return data as Job;
}

// Best score first; on a tie the cheaper agent wins.
async function ranked(jobId: string): Promise<{ audition: Audition; card: AgentCard }[]> {
  const cards = await loadCards();
  const { data } = await admin()
    .from("auditions")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "scored");
  return ((data ?? []) as Audition[])
    .map((audition) => ({ audition, card: cards.find((c) => c.id === audition.agent_id) }))
    .filter((c): c is { audition: Audition; card: AgentCard } => Boolean(c.card))
    .sort(
      (a, b) =>
        Number(b.audition.score) - Number(a.audition.score) ||
        a.card.price_cents - b.card.price_cents,
    );
}

// The voice job reads the hired script, else the best script sample, else the audition line.
async function scriptFor(runId: string): Promise<string> {
  const db = admin();
  const { data: scripts } = await db
    .from("jobs")
    .select("id, output_text")
    .eq("run_id", runId)
    .eq("skill", "script");
  const hired = scripts?.find((s) => s.output_text)?.output_text;
  if (hired) return hired;
  if (!scripts?.length) return AUDITION_VOICE_LINE;
  const { data: best } = await db
    .from("auditions")
    .select("output_text")
    .in("job_id", scripts.map((s) => s.id))
    .eq("status", "scored")
    .not("output_text", "is", null)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  return best?.output_text ?? AUDITION_VOICE_LINE;
}

async function hireJob(jobId: string): Promise<Job> {
  const db = admin();
  const job = await loadJob(jobId);
  if (job.status === "hired" || job.status === "done") return job;

  const candidates = await ranked(job.id);
  if (!candidates.length) throw new HireError(`no scored audition for the ${job.skill} job`, 409);

  // Only one caller wins the claim, so a double tap never runs or pays twice.
  const { data: claimed } = await db
    .from("jobs")
    .update({ status: "hired", winner_agent_id: candidates[0].card.id })
    .eq("id", job.id)
    .in("status", ["waiting", "auditioning"])
    .select()
    .maybeSingle();
  if (!claimed) return loadJob(job.id);
  await db.from("runs").update({ status: "hiring" }).eq("id", job.run_id);

  const req: JobRequest = {
    job_id: job.id,
    skill: job.skill,
    brief: job.brief,
    sample: false,
    ...(job.skill === "voice" ? { input_text: await scriptFor(job.run_id) } : {}),
  };

  // Try the winner, then the runner up once.
  let winner: AgentCard | null = null;
  let result: JobResult | null = null;
  let lastError: unknown = null;
  for (const [i, { card }] of candidates.slice(0, 2).entries()) {
    if (i > 0) await db.from("jobs").update({ winner_agent_id: card.id }).eq("id", job.id);
    try {
      result = await runAgent(card, req);
      winner = card;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!winner || !result) {
    await db.from("jobs").update({ status: "waiting", winner_agent_id: null }).eq("id", job.id);
    throw new HireError(`full job failed: ${shortError(lastError)}`, 500);
  }

  // A failed payment is recorded, not fatal: the work is done and the receipt shows it.
  let paid: { stripe_id: string | null; status: string };
  try {
    paid = await pay({
      run_id: job.run_id,
      job_id: job.id,
      agent_id: winner.id,
      amount_cents: winner.price_cents,
      description: `Blast: ${winner.name} (${job.skill})`,
    });
  } catch {
    paid = { stripe_id: null, status: "failed" };
  }
  await db.from("payments").insert({
    run_id: job.run_id,
    job_id: job.id,
    agent_id: winner.id,
    amount_cents: winner.price_cents,
    stripe_id: paid.stripe_id,
    status: paid.status,
  });

  const { data: done } = await db
    .from("jobs")
    .update({
      status: "done",
      winner_agent_id: winner.id,
      output_text: result.text ?? null,
      audio_url: result.audio_url ?? null,
    })
    .eq("id", job.id)
    .select()
    .single();

  const { data: jobs } = await db.from("jobs").select("status").eq("run_id", job.run_id);
  if (jobs?.length && jobs.every((j) => j.status === "done")) {
    await db.from("runs").update({ status: "done" }).eq("id", job.run_id);
  }
  return done as Job;
}

async function hireRun(runId: string): Promise<Job[]> {
  const { data, error } = await admin().from("jobs").select("*").eq("run_id", runId);
  if (error) throw new HireError(error.message, 500);
  if (!data?.length) throw new HireError("run has no jobs", 404);
  const ordered = (data as Job[]).sort(
    (a, b) => a.order - b.order || Number(b.skill === "script") - Number(a.skill === "script"),
  );
  const hired: Job[] = [];
  for (const job of ordered) {
    const result = await hireJob(job.id);
    hired.push(result);
    // Still "hired" means another call owns it; stop so voice never runs before its script.
    if (result.status !== "done") break;
  }
  return hired;
}

export async function hire(target: { job_id: string } | { run_id: string }): Promise<PipelineResult> {
  try {
    if ("job_id" in target) return { status: 200, body: { job: await hireJob(target.job_id) } };
    return { status: 200, body: { jobs: await hireRun(target.run_id) } };
  } catch (err) {
    const status = err instanceof HireError ? err.status : 500;
    return { status, body: { error: shortError(err) } };
  }
}
