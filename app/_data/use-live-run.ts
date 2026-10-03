"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  RUN_BUDGET_CENTS,
  RUN_PRICE_CENTS,
  type Audition,
  type Job,
  type Payment,
  type Run,
  type RunMode,
} from "@/lib/types";
import { CARDS } from "./fake";
import { EMPTY, type RunApi, type RunState } from "./run-state";

const POLL_MS = 1500;

let client: SupabaseClient | null = null;
function supabase() {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

function upsert<T extends { id: string }>(rows: T[], row: T) {
  return rows.some((r) => r.id === row.id)
    ? rows.map((r) => (r.id === row.id ? row : r))
    : [...rows, row];
}

async function load(runId: string): Promise<RunState | null> {
  const db = supabase();
  const [run, jobs, payments] = await Promise.all([
    db.from("runs").select("*").eq("id", runId).maybeSingle(),
    db.from("jobs").select("*").eq("run_id", runId),
    db.from("payments").select("*").eq("run_id", runId),
  ]);
  if (!run.data) return null;
  const jobRows = (jobs.data ?? []) as Job[];
  const auditions = jobRows.length
    ? await db.from("auditions").select("*").in("job_id", jobRows.map((j) => j.id))
    : { data: [] };
  return {
    run: run.data as Run,
    jobs: jobRows,
    auditions: (auditions.data ?? []) as Audition[],
    payments: (payments.data ?? []) as Payment[],
  };
}

async function call(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `${path} failed (${res.status})`);
  return json;
}

// The real run: the API routes write the tables, this reads them. Realtime
// pushes job and audition rows as they change. A slow poll covers the run
// and payment rows, which are not on Realtime, and any missed event.
export function useLiveRun(): RunApi {
  const [state, setState] = useState<RunState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const jobIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    jobIds.current = new Set(state.jobs.map((job) => job.id));
  }, [state.jobs]);

  const done = state.run?.status === "done";

  useEffect(() => {
    if (!runId) return;
    let active = true;

    const refresh = () =>
      load(runId).then((next) => {
        if (active && next) setState(next);
      });

    const channel = supabase()
      .channel(`run-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `run_id=eq.${runId}` },
        (payload) => {
          const row = payload.new as Job;
          if (active && row?.id) setState((s) => ({ ...s, jobs: upsert(s.jobs, row) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auditions" },
        (payload) => {
          const row = payload.new as Audition;
          if (active && row?.id && jobIds.current.has(row.job_id)) {
            setState((s) => ({ ...s, auditions: upsert(s.auditions, row) }));
          }
        },
      )
      .subscribe();

    const timer = done ? null : window.setInterval(refresh, POLL_MS);
    refresh();

    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      supabase().removeChannel(channel);
    };
  }, [runId, done]);

  const start = useCallback((goal: string, mode: RunMode) => {
    setError(null);
    setRunId(null);
    // Shown while the manager splits the goal, before the run row exists.
    setState({
      ...EMPTY,
      run: {
        id: "pending",
        goal,
        mode,
        budget_cents: RUN_BUDGET_CENTS,
        price_cents: RUN_PRICE_CENTS,
        status: "splitting",
        created_at: new Date().toISOString(),
      },
    });
    call("/api/run", { goal, mode })
      .then(({ run, jobs }: { run: Run; jobs: Job[] }) => {
        setState({ ...EMPTY, run, jobs });
        setRunId(run.id);
      })
      .catch((err: Error) => {
        setState(EMPTY);
        setError(err.message);
      });
  }, []);

  const approve = useCallback(() => {
    if (!runId) return;
    setError(null);
    setState((s) => (s.run ? { ...s, run: { ...s.run, status: "hiring" } } : s));
    call("/api/hire", { run_id: runId }).catch((err: Error) =>
      setError(err.message),
    );
  }, [runId]);

  const reject = useCallback(() => {
    setError(null);
    setRunId(null);
    setState(EMPTY);
  }, []);

  return { ...state, error, cards: CARDS, start, approve, reject };
}
