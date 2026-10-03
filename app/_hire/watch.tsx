"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { db } from "./db";

type Row = { id: string; created_at: string };

// Projector mode: follow every need Claude Code posts. Realtime catches the INSERT; a slow poll covers a dropped socket.
export function useWatch(on: boolean, onNeed: (id: string) => void) {
  const cb = useRef(onNeed);
  useEffect(() => {
    cb.current = onNeed;
  }, [onNeed]);

  useEffect(() => {
    if (!on) return;
    let active = true;
    let last: Row | null = null;
    let ready = false;

    const latest = async () => {
      const { data } = await db()
        .from("needs")
        .select("id,created_at")
        .eq("source", "claude-code")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Row | null;
    };

    const take = (row: Row) => {
      if (!active || (last && (row.id === last.id || row.created_at <= last.created_at))) return;
      last = row;
      if (ready) cb.current(row.id);
    };

    // The newest need at load time is the baseline, not a new hire.
    latest()
      .then((row) => {
        if (row && !last) last = row;
      })
      .catch(() => {})
      .finally(() => {
        ready = true;
      });

    const channel = db()
      .channel("watch-claude-code")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "needs", filter: "source=eq.claude-code" },
        (p) => take(p.new as Row),
      )
      .subscribe();
    const timer = window.setInterval(() => {
      if (!ready) return;
      latest()
        .then((row) => row && take(row))
        .catch(() => {});
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(timer);
      db().removeChannel(channel);
    };
  }, [on]);
}

export function Waiting() {
  return (
    <div className="mt-16 flex items-center justify-center gap-3 text-xl text-muted-foreground">
      <Loader2 className="size-5 animate-spin" /> Waiting for an agent to hire...
    </div>
  );
}
