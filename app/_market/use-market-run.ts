"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { Audition, Job, Payment, Run } from "@/lib/types";

let client: SupabaseClient | null = null;

function db() {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false } },
  );
  return client;
}

export type RunView = {
  run: Run | null;
  jobs: Job[];
  auditions: Audition[];
  payments: Payment[];
};

const EMPTY: RunView = { run: null, jobs: [], auditions: [], payments: [] };

async function load(runId: string): Promise<RunView> {
  const s = db();
  const [{ data: run }, { data: jobs }, { data: payments }] = await Promise.all([
    s.from("runs").select("*").eq("id", runId).maybeSingle(),
    s.from("jobs").select("*").eq("run_id", runId).order("order"),
    s.from("payments").select("*").eq("run_id", runId),
  ]);
  const ids = (jobs ?? []).map((job: Job) => job.id);
  let auditions: Audition[] = [];
  if (ids.length) {
    const { data } = await s.from("auditions").select("*").in("job_id", ids);
    auditions = data ?? [];
  }
  return { run: run ?? null, jobs: jobs ?? [], auditions, payments: payments ?? [] };
}

// Realtime pushes changes as they land; a slow poll covers a dropped socket.
export function useMarketRun(runId: string | null) {
  const [view, setView] = useState<RunView>(EMPTY);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    const refresh = () =>
      load(runId)
        .then((next) => {
          if (active) setView(next);
        })
        .catch(() => {});

    const channel = db()
      .channel(`market-${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auditions" }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `run_id=eq.${runId}` },
        refresh,
      )
      .subscribe();
    const timer = window.setInterval(refresh, 2500);
    refresh();

    return () => {
      active = false;
      window.clearInterval(timer);
      db().removeChannel(channel);
    };
  }, [runId]);

  return runId ? view : EMPTY;
}
