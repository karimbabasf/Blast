import { cardById } from "@/lib/agents/cards";
import { runAgent } from "@/lib/agents";
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

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function loadJob(jobId: string): Promise<Job> {
  const { data, error } = await admin().from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw new HireError(error.message, 500);
  if (!data) throw new HireError("job not found", 404);
  return data as Job;
}

// Best score first; on a tie the cheaper agent wins.
async function ranked(jobId: string): Promise<{ audition: Audition; card: AgentCard }[]> {
  const { data } = await admin()
    .from("auditions")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "scored");
  return ((data ?? []) as Audition[])
    .map((audition) => ({ audition, card: cardById(audition.agent_id) }))
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = body?.job_id;
  const runId = body?.run_id;
  const id = typeof jobId === "string" ? jobId : runId;
  if (typeof id !== "string" || !UUID.test(id)) {
    return Response.json({ error: "send job_id or run_id as a UUID" }, { status: 400 });
  }

  try {
    if (typeof jobId === "string") return Response.json({ job: await hireJob(jobId) });
    return Response.json({ jobs: await hireRun(runId) });
  } catch (err) {
    const status = err instanceof HireError ? err.status : 500;
    return Response.json({ error: shortError(err) }, { status });
  }
}
