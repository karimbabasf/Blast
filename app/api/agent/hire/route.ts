import { Credential, Receipt } from "mppx";
import { HOLD_CENTS, proofMpp, settle, type Hold } from "@/lib/pay/proof";
import { hireOnProof, startNeed } from "@/lib/runtime/hire";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The Shared Payment Token the buyer paid with, shown on the receipt strip.
function sptOf(request: Request): string | undefined {
  try {
    const payload = Credential.fromRequest<{ spt?: string }>(request).payload;
    return typeof payload?.spt === "string" ? payload.spt : undefined;
  } catch {
    return undefined;
  }
}

// POST /api/agent/hire { job }: 402 with an MPP challenge for a hold. Once paid, the specialists try out
// live, the winner does the job, and the hold is captured only if the winner passed every check.
export async function POST(request: Request) {
  const body = await request
    .clone()
    .json()
    .catch(() => ({}));
  const job = typeof body?.job === "string" ? body.job.trim() : "";
  if (!job || job.length > 2000) return Response.json({ error: "job must be 1 to 2000 characters" }, { status: 400 });

  const charge = await proofMpp().charge({
    amount: (HOLD_CENTS / 100).toFixed(2),
    description: "Blast: hold for one specialist job, captured only on proof",
  })(request);
  if (charge.status === 402) return charge.challenge;

  const receipt = Receipt.fromResponse(charge.withReceipt(new Response(null)) as Response);
  const hold: Hold = {
    status: "held",
    payment_intent: receipt.reference,
    amount_cents: HOLD_CENTS,
    via: "mpp",
    spt: sptOf(request),
  };
  try {
    const need = await startNeed(job, "claude-code", hold);
    return charge.withReceipt(Response.json(await hireOnProof(need, hold))) as Response;
  } catch (err) {
    const released = await settle(hold, null).catch(() => hold);
    return Response.json(
      { error: (err instanceof Error ? err.message : String(err)).slice(0, 200), payment: released },
      { status: 502 },
    );
  }
}
