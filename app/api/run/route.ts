import { after } from "next/server";
import { POST as audition } from "@/app/api/audition/route";
import { POST as hire } from "@/app/api/hire/route";
import { cardById } from "@/lib/agents/cards";
import { splitGoal } from "@/lib/manager";
import { admin } from "@/lib/supabase-admin";
import {
  RUN_BUDGET_CENTS,
  RUN_PRICE_CENTS,
  type Audition,
  type Job,
  type Run,
} from "@/lib/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function post(path: string, body: unknown) {
  return new Request(`http://blast.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Auto mode: hire without an approve tap while the winners fit the budget.
// Over budget, the run stays at "waiting" and the owner decides.
async function autoHire(run: Run, jobs: Job[]) {
  const { data } = await admin()
    .from("auditions")
    .select("*")
    .in("job_id", jobs.map((job) => job.id))
    .eq("status", "scored");
  const scored = (data ?? []) as Audition[];

  const total = jobs.reduce((sum, job) => {
    const prices = scored
      .filter((a) => a.job_id === job.id)
      .sort(
        (a, b) =>
          Number(b.score) - Number(a.score) ||
          (cardById(a.agent_id)?.price_cents ?? 0) -
            (cardById(b.agent_id)?.price_cents ?? 0),
      )
      .map((a) => cardById(a.agent_id)?.price_cents ?? 0);
    return sum + (prices[0] ?? 0);
  }, 0);

  if (total > 0 && total <= run.budget_cents) {
    await hire(post("/api/hire", { run_id: run.id }));
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  const mode = body?.mode === "auto" ? "auto" : "approve";
  if (!goal || goal.length > 500) {
    return Response.json(
      { error: "goal must be 1 to 500 characters" },
      { status: 400 },
    );
  }

  try {
    const db = admin();
    const { data: run, error: runError } = await db
      .from("runs")
      .insert({
        goal,
        mode,
        budget_cents: RUN_BUDGET_CENTS,
        price_cents: RUN_PRICE_CENTS,
        status: "splitting",
      })
      .select()
      .single();
    if (runError) throw new Error(runError.message);

    const split = await splitGoal(goal);
    const { data: jobs, error: jobsError } = await db
      .from("jobs")
      .insert(
        split.map((job, index) => ({
          run_id: run.id,
          skill: job.skill,
          brief: job.brief,
          order: index + 1,
          status: "auditioning",
        })),
      )
      .select();
    if (jobsError) throw new Error(jobsError.message);

    await db.from("runs").update({ status: "auditioning" }).eq("id", run.id);

    // Auditions take a while, so they run after the response. The page
    // watches the tables for the results.
    after(async () => {
      await Promise.allSettled(
        (jobs as Job[]).map((job) =>
          audition(post("/api/audition", { job_id: job.id })),
        ),
      );
      if (mode === "auto") await autoHire(run as Run, jobs as Job[]);
    });

    return Response.json({ run: { ...run, status: "auditioning" }, jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message.slice(0, 200) }, { status: 500 });
  }
}
