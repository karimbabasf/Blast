import { Receipt } from "mppx";
import { auditionJob, hire } from "@/lib/agents/pipeline";
import { mpp, stripeClient } from "@/lib/pay/mpp";
import { admin } from "@/lib/supabase-admin";
import { RUN_BUDGET_CENTS, RUN_PRICE_CENTS, type Job } from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_GOAL = "Make me a 15 second radio ad for Xochitl Coffee.";
const JOBS = [
  { skill: "script", order: 1, brief: "Write a 15 second radio script for Xochitl Coffee." },
  { skill: "voice", order: 2, brief: "Record the winning script as a radio voice-over." },
] as const;

function shortError(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 100);
}

// The whole pipeline in process: one run, both auditions in parallel, then the hire.
async function runPipeline(goal: string) {
  const db = admin();
  const { data: run, error: runError } = await db
    .from("runs")
    .insert({
      goal,
      mode: "auto",
      budget_cents: RUN_BUDGET_CENTS,
      price_cents: RUN_PRICE_CENTS,
      status: "auditioning",
    })
    .select()
    .single();
  if (runError) throw new Error(runError.message);

  const { data: jobs, error: jobsError } = await db
    .from("jobs")
    .insert(JOBS.map((job) => ({ ...job, run_id: run.id, status: "auditioning" })))
    .select();
  if (jobsError) throw new Error(jobsError.message);

  const auditions = await Promise.all((jobs as Job[]).map((job) => auditionJob(job.id)));
  const failed = auditions.find((a) => a.status !== 200);
  if (failed) throw new Error(`audition failed: ${failed.body.error}`);

  const hired = await hire({ run_id: run.id });
  if (hired.status !== 200) throw new Error(`hire failed: ${hired.body.error}`);
  const done = hired.body.jobs as Job[];
  if (done.length !== JOBS.length || done.some((job) => job.status !== "done")) {
    throw new Error("hire did not finish both jobs");
  }

  const { data: payments } = await db
    .from("payments")
    .select("job_id, agent_id, amount_cents")
    .eq("run_id", run.id);
  const winners = await Promise.all(
    done.map(async (job) => {
      const { data: tryout } = await db
        .from("auditions")
        .select("score")
        .eq("job_id", job.id)
        .eq("agent_id", job.winner_agent_id)
        .maybeSingle();
      const payment = payments?.find((p) => p.job_id === job.id);
      return {
        skill: job.skill,
        agent_id: job.winner_agent_id,
        score: tryout?.score === null || tryout?.score === undefined ? null : Number(tryout.score),
        paid_cents: payment?.amount_cents ?? 0,
      };
    }),
  );
  const payouts = winners.reduce((sum, w) => sum + w.paid_cents, 0);

  return {
    run_id: run.id as string,
    script: done.find((job) => job.skill === "script")?.output_text ?? null,
    audio_url: done.find((job) => job.skill === "voice")?.audio_url ?? null,
    winners,
    paid_cents: RUN_PRICE_CENTS,
    payouts_cents: payouts,
    margin_cents: RUN_PRICE_CENTS - payouts,
  };
}

// POST /api/agent/hire { goal? }: 402 with an MPP challenge until paid, then the finished ad and a receipt.
export async function POST(request: Request) {
  const body = await request
    .clone()
    .json()
    .catch(() => ({}));
  const goal = body?.goal ?? DEFAULT_GOAL;
  if (typeof goal !== "string" || !goal.trim() || goal.length > 200) {
    return Response.json({ error: "goal must be 1 to 200 characters" }, { status: 400 });
  }

  const charge = await mpp().charge({
    amount: (RUN_PRICE_CENTS / 100).toFixed(2),
    description: "Blast: one finished 15 second radio ad",
  })(request);
  if (charge.status === 402) return charge.challenge;

  const receipt = Receipt.fromResponse(charge.withReceipt(new Response(null)) as Response);
  try {
    const result = await runPipeline(goal.trim());
    return charge.withReceipt(
      Response.json({ ...result, stripe_payment: receipt.reference }),
    ) as Response;
  } catch (err) {
    // The buyer paid before the work ran, so a failed run gives the money back.
    const refund = await stripeClient()
      .refunds.create({ payment_intent: receipt.reference })
      .catch(() => null);
    return Response.json(
      {
        error: shortError(err),
        stripe_payment: receipt.reference,
        refund: refund?.id ?? "refund failed",
      },
      { status: 502 },
    );
  }
}
