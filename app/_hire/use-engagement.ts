"use client";

import { useEffect, useState } from "react";
import type { CalEvent, Draft, Engagement, EngagementMessage, MailThread, MarketAgent } from "@/lib/market/types";
import { db } from "./db";

export type EngagementView = {
  engagement: Engagement | null;
  agent: MarketAgent | null;
  messages: EngagementMessage[];
  events: CalEvent[];
  mail: MailThread[];
  drafts: Draft[];
  fresh: Set<string>; // ids that appeared or changed in the last few seconds
  loaded: boolean;
};

const EMPTY: EngagementView = {
  engagement: null,
  agent: null,
  messages: [],
  events: [],
  mail: [],
  drafts: [],
  fresh: new Set(),
  loaded: false,
};

const FRESH_MS = 8000;

async function load(id: string) {
  const s = db();
  const [{ data: engagement }, { data: messages }, { data: events }, { data: mail }, { data: drafts }] = await Promise.all([
    s.from("engagements").select("*").eq("id", id).maybeSingle(),
    s.from("engagement_messages").select("*").eq("engagement_id", id).order("created_at"),
    s.from("live_events").select("*").order("start"),
    s.from("live_mail").select("*").order("received_at", { ascending: false }).limit(40),
    s.from("live_drafts").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  let agent: MarketAgent | null = null;
  if (engagement) {
    const { data } = await s.from("market_agents").select("*").eq("id", engagement.agent_id).maybeSingle();
    agent = data ?? null;
  }
  return {
    engagement: (engagement ?? null) as Engagement | null,
    agent,
    messages: (messages ?? []) as EngagementMessage[],
    events: (events ?? []) as CalEvent[],
    mail: (mail ?? []) as MailThread[],
    drafts: (drafts ?? []) as Draft[],
  };
}

// synced_at moves on every sync, so it is left out or every row would look new.
function fingerprint(row: object) {
  return JSON.stringify(row, (key, value) => (key === "synced_at" ? undefined : value));
}

// Every action the agent takes lands in a live_* row; Realtime pushes it, a slow poll covers a dropped socket.
export function useEngagement(id: string) {
  const [view, setView] = useState<EngagementView>(EMPTY);

  useEffect(() => {
    let active = true;
    let first = true;
    const seen = new Map<string, string>();
    const freshUntil = new Map<string, number>();

    const refresh = () =>
      load(id)
        .then((next) => {
          if (!active) return;
          const now = Date.now();
          for (const row of [...next.events, ...next.mail, ...next.drafts]) {
            const fp = fingerprint(row);
            if (!first && seen.get(row.id) !== fp) freshUntil.set(row.id, now + FRESH_MS);
            seen.set(row.id, fp);
          }
          first = false;
          const fresh = new Set([...freshUntil].filter(([, t]) => t > now).map(([k]) => k));
          setView({ ...next, fresh, loaded: true });
        })
        .catch(() => {});

    const channel = db().channel(`engagement-${id}`);
    for (const table of ["live_events", "live_mail", "live_drafts"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "engagement_messages", filter: `engagement_id=eq.${id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "engagements", filter: `id=eq.${id}` }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 2500);
    refresh();

    return () => {
      active = false;
      window.clearInterval(timer);
      db().removeChannel(channel);
    };
  }, [id]);

  return view;
}
