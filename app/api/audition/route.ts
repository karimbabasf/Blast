import { CARDS, cardById } from "@/lib/agents/cards";
import { judgeResult, runAgent } from "@/lib/agents";
import { admin } from "@/lib/supabase-admin";
import { AUDITION_VOICE_LINE, type Audition, type Job, type JobRequest } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shortError(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 100);
}

function clampScore(score: number) {
  return Math.round(Math.min(10, Math.max(0, Number(score) || 0)) * 10) / 10;
}

async function audition(job: Job, row: Audition) {
  const db = admin();
  try {
    const card = cardById(row.agent_id);
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = body?.job_id;
  if (typeof jobId !== "string" || !UUID.test(jobId)) {
    return Response.json({ error: "job_id must be a UUID" }, { status: 400 });
  }

  const db = admin();
  const { data: job, error } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  const rows = CARDS.map((card) => {
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
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  if (inserted?.length) {
    const running = inserted.filter((row: Audition) => row.status === "running");
    await Promise.allSettled(running.map((row: Audition) => audition(job as Job, row)));

    await db.from("jobs").update({ status: "waiting" }).eq("id", jobId).eq("status", "auditioning");
    const { data: jobs } = await db.from("jobs").select("status").eq("run_id", job.run_id);
    if (jobs?.length && jobs.every((j) => j.status === "waiting")) {
      await db.from("runs").update({ status: "waiting" }).eq("id", job.run_id);
    }
  }

  const { data: auditions } = await db.from("auditions").select("*").eq("job_id", jobId);
  return Response.json({ auditions: auditions ?? [] });
}
