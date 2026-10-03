import { NextResponse, type NextRequest } from "next/server";
import { syncLive } from "@/lib/google/backend";
import { connectAccount, STATE_COOKIE } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Google sends the owner back here: store the tokens, fill the live mirror, return to the app.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const home = (status: string) => {
    const res = NextResponse.redirect(new URL(`/?google=${status}`, url.origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return res;
  };

  if (url.searchParams.get("error") || !code) return home("denied");
  if (!state || state !== req.cookies.get(STATE_COOKIE)?.value) return home("bad_state");

  try {
    await connectAccount(code, url.origin);
  } catch {
    return home("failed");
  }
  // The account is connected even if the first sync fails; POST /api/google/sync retries it.
  await syncLive().catch(() => null);
  return home("connected");
}
