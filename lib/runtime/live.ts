// The backends a hired agent works on: the real Google account, or google's Supabase fallback when none is connected.

import { liveCalendar, liveMail } from "@/lib/google/backend";
import type { Backends } from "@/lib/roles";

export async function liveBackends(): Promise<Backends> {
  const [calendar, mail] = await Promise.all([liveCalendar(), liveMail()]);
  return { calendar, mail };
}
