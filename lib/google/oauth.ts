// OAuth for the one demo Google account the hired agent works on. Tokens live in google_accounts (service role only).

import { admin } from "@/lib/supabase-admin";

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
];

export const STATE_COOKIE = "blast_google_state";

export type Account = {
  id: string;
  email: string;
  refresh_token: string;
  access_token: string | null;
  expires_at: string | null;
  calendar_id: string | null; // the secondary "Blast demo" calendar, the only one the agent may touch
  label_id: string | null; // the "Blast demo" Gmail label, the only threads the agent may touch
};

function client() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
  return { id, secret };
}

export function redirectUri(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function consentUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: client().id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const { id, secret } = client();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, client_id: id, client_secret: secret }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token request failed: ${json.error ?? res.status} ${json.error_description ?? ""}`);
  }
  return json as { access_token: string; refresh_token?: string; expires_in: number };
}

// Exchanges the consent code, reads the account's email, and stores the tokens.
export async function connectAccount(code: string, origin: string): Promise<string> {
  const tokens = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(origin),
  });
  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const { email } = (await me.json()) as { email?: string };
  if (!email) throw new Error("Google did not return an email");

  const db = admin();
  const row: Record<string, string> = {
    email,
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  if (tokens.refresh_token) row.refresh_token = tokens.refresh_token;
  const { error } = await db.from("google_accounts").upsert(row, { onConflict: "email" });
  if (error) throw new Error(`google_accounts upsert failed: ${error.message}`);
  return email;
}

// The most recently connected account, or null when nobody has connected yet.
export async function account(): Promise<Account | null> {
  const { data } = await admin()
    .from("google_accounts")
    .select("id, email, refresh_token, access_token, expires_at, calendar_id, label_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Account | null) ?? null;
}

// A valid access token, refreshed when it is within a minute of expiring.
export async function accessToken(acct: Account): Promise<string> {
  const fresh = acct.expires_at && new Date(acct.expires_at).getTime() - Date.now() > 60_000;
  if (acct.access_token && fresh) return acct.access_token;
  const tokens = await tokenRequest({ refresh_token: acct.refresh_token, grant_type: "refresh_token" });
  const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await admin()
    .from("google_accounts")
    .update({ access_token: tokens.access_token, expires_at })
    .eq("id", acct.id);
  acct.access_token = tokens.access_token;
  acct.expires_at = expires_at;
  return tokens.access_token;
}
