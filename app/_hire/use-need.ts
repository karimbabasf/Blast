"use client";

import { useEffect, useState } from "react";
import type { MarketAgent, Need, Tryout, TryoutStep } from "@/lib/market/types";
import { db } from "./db";

export type NeedView = {
  need: Need | null;
  agents: MarketAgent[];
  tryouts: Tryout[];
  steps: TryoutStep[];
};

const EMPTY: NeedView = { need: null, agents: [], tryouts: [], steps: [] };

async function load(needId: string): Promise<NeedView> {
  const s = db();
  const [{ data: need }, { data: tryouts }] = await Promise.all([
    s.from("needs").select("*").eq("id", needId).maybeSingle(),
    s.from("tryouts").select("*").eq("need_id", needId).order("created_at"),
  ]);
  if (!need) return EMPTY;
  const ids = (tryouts ?? []).map((t: Tryout) => t.id);
  const [{ data: agents }, steps] = await Promise.all([
    s.from("market_agents").select("id,name,builder,role,description,model,tools,price_month_cents,price_action_cents,runs_in,auditionable,stripe_account").eq("role", need.role),
    ids.length
      ? s.from("tryout_steps").select("*").in("tryout_id", ids).order("n").then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  return { need, agents: (agents ?? []) as MarketAgent[], tryouts: tryouts ?? [], steps: steps as TryoutStep[] };
}

// Realtime pushes each step as the tryouts write it; a slow poll covers a dropped socket.
export function useNeed(needId: string | null) {
  const [view, setView] = useState<NeedView>(EMPTY);

  useEffect(() => {
    if (!needId) return;
    let active = true;
    const refresh = () =>
      load(needId)
        .then((next) => {
          if (active) setView(next);
        })
        .catch(() => {});

    const channel = db()
      .channel(`need-${needId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tryout_steps" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tryouts", filter: `need_id=eq.${needId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "needs", filter: `id=eq.${needId}` }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 2500);
    refresh();

    return () => {
      active = false;
      window.clearInterval(timer);
      db().removeChannel(channel);
    };
  }, [needId]);

  return needId ? view : EMPTY;
}
