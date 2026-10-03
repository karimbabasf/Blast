import { NextResponse } from "next/server";
import { syncLive } from "@/lib/google/backend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pulls the connected account's next 14 days of events and latest 25 threads into the live_* mirror.
export async function POST() {
  try {
    return NextResponse.json(await syncLive());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: message.startsWith("No Google") ? 409 : 502 });
  }
}
