import { NextResponse, type NextRequest } from "next/server";
import { consentUrl, STATE_COOKIE } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

// Sends the demo account owner to Google's consent screen for Calendar and Gmail.
export function GET(req: NextRequest) {
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(consentUrl(req.nextUrl.origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/api/google",
    maxAge: 600,
  });
  return res;
}
