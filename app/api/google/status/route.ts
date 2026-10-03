import { NextResponse } from "next/server";
import { account } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

// Whether a real Google account is connected. Never returns tokens.
export async function GET() {
  const acct = await account();
  return NextResponse.json({ connected: !!acct, email: acct?.email ?? null });
}
