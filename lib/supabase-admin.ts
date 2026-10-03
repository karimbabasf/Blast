import { createClient } from "@supabase/supabase-js";

// Server only: it holds the service role key. Never import from a client component.
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is missing");
  return createClient(url, key, { auth: { persistSession: false } });
}
