import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/google/backend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Puts the demo calendar and inbox back to the seeded state before a rehearsal or the stage run.
export async function POST() {
  try {
    return NextResponse.json(await resetDemo());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
