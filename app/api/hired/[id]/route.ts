import { judgeResult, runAgent } from "@/lib/agents";
import { pay } from "@/lib/pay";
import { admin } from "@/lib/supabase-admin";
import type { JobRequest, JobResult, Verdict } from "@/lib/types";
import { average, findCard, hireCard, UUID, type Hire } from "../card";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function loadHire(id: string): Promise<Hire | null> {
  if (!UUID.test(id)) return null;
  const { data } = await admin().from("hires").select("*").eq("id", id).maybeSingle();
  return (data as Hire | null) ?? null;
}

function short(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 200);
}

// GET /api/hired/<id>: the hire card, so a person or an agent knows how to call it.
export async function GET(request: Request, ctx: Ctx) {
  const hire = await loadHire((await ctx.params).id);
  if (!hire) return Response.json({ error: "no such hire" }, { status: 404 });
  const { data: calls } = await admin()
    .from("hire_calls")
    .select("id, input_text, output_text, audio_url, score, reason, amount_cents, stripe_id, status, created_at")
    .eq("hire_id", hire.id)
    .order("created_at", { ascending: false });
  const card = await findCard(hire.agent_id);
  return Response.json({
    ...hireCard(hire, card, new URL(request.url).origin, average((calls ?? []).map((c) => c.score))),
    recent_calls: (calls ?? []).slice(0, 5),
  });
}

// POST /api/hired/<id> { input }: new work for the hired agent, judged live and billed per call.
export async function POST(request: Request, ctx: Ctx) {
  const hire = await loadHire((await ctx.params).id);
  if (!hire) return Response.json({ error: "no such hire" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input || input.length > 500) {
    return Response.json({ error: "input must be 1 to 500 characters" }, { status: 400 });
  }
  const card = await findCard(hire.agent_id);
  if (!card) return Response.json({ error: `agent ${hire.agent_id} is no longer listed` }, { status: 410 });

  const db = admin();
  // The agent keeps working for the same business, so the brief it was hired on comes along.
  const { data: job } = await db.from("jobs").select("brief").eq("id", hire.job_id).maybeSingle();
  const brief = job?.brief ? `${job.brief}\n\nThis time: ${input}` : input;
  // Each call gets its own id, so its audio file and its Stripe idempotency key never collide.
  const callId = crypto.randomUUID();
  const req: JobRequest =
    hire.skill === "voice"
      ? { job_id: callId, skill: "voice", brief, sample: false, input_text: input }
      : { job_id: callId, skill: "script", brief, sample: false };

  let result: JobResult;
  try {
    result = await runAgent(card, req);
  } catch (err) {
    await db.from("hire_calls").insert({
      id: callId,
      hire_id: hire.id,
      input_text: input,
      reason: short(err),
      status: "agent_failed",
    });
    return Response.json({ error: `${card.name} failed: ${short(err)}` }, { status: 502 });
  }

  let verdict: Verdict | null = null;
  try {
    verdict = await judgeResult(req, result);
  } catch {
    verdict = null;
  }

  const price = hire.price_cents ?? card.price_cents;
  if (hire.price_cents === null) await db.from("hires").update({ price_cents: price }).eq("id", hire.id);

  // A failed payment is recorded, not fatal: the work is done and the receipt shows it.
  let paid: { stripe_id: string | null; status: string };
  try {
    paid = await pay({
      run_id: hire.run_id,
      job_id: `${hire.job_id}:call:${callId}`,
      agent_id: card.id,
      amount_cents: price,
      description: "Blast hired agent call",
    });
  } catch {
    paid = { stripe_id: null, status: "failed" };
  }
  const paidCents = paid.status === "failed" ? 0 : price;

  const row = {
    id: callId,
    hire_id: hire.id,
    input_text: input,
    output_text: result.text ?? null,
    audio_url: result.audio_url ?? null,
    score: verdict?.score ?? null,
    reason: verdict?.reason ?? "the judges could not score this call",
    amount_cents: paidCents,
    stripe_id: paid.stripe_id,
    status: paid.status,
  };
  const { error } = await db.from("hire_calls").insert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    call_id: callId,
    output_text: row.output_text,
    audio_url: row.audio_url,
    score: row.score,
    reason: row.reason,
    paid_cents: paidCents,
    stripe_id: paid.stripe_id,
  });
}
