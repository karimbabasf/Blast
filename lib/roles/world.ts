// A private copy of the business's account for one tryout, on the world_* tables.

import type { CalEvent, CalendarBackend, Draft, MailBackend, MailThread } from "@/lib/market/types";
import { admin } from "@/lib/supabase-admin";
import { seedEvents, seedMail } from "./seed";

type EventRow = CalEvent & { world_id: string };
type MailRow = MailThread & { world_id: string; body: string };

const toEvent = (r: EventRow): CalEvent => ({
  id: r.id,
  title: r.title,
  start: new Date(r.start).toISOString(),
  end: new Date(r.end).toISOString(),
  attendees: r.attendees ?? [],
});

const toThread = (r: MailRow): MailThread => ({
  id: r.id,
  from: r.from,
  subject: r.subject,
  snippet: r.snippet,
  labels: r.labels ?? [],
  archived: r.archived,
  received_at: r.received_at,
});

// Makes a world from the fixed seed and returns its id.
export async function createWorld(tryoutId: string | null): Promise<string> {
  const db = admin();
  const { data, error } = await db.from("worlds").insert({ tryout_id: tryoutId }).select("id").single();
  if (error) throw new Error(`world insert failed: ${error.message}`);
  const worldId = data.id as string;
  const [ev, mail] = await Promise.all([
    db.from("world_events").insert(seedEvents().map((e) => ({ ...e, world_id: worldId }))),
    db.from("world_mail").insert(seedMail().map((m) => ({ ...m, world_id: worldId }))),
  ]);
  if (ev.error) throw new Error(`world events seed failed: ${ev.error.message}`);
  if (mail.error) throw new Error(`world mail seed failed: ${mail.error.message}`);
  return worldId;
}

export async function worldState(worldId: string) {
  const db = admin();
  const [ev, mail, drafts] = await Promise.all([
    db.from("world_events").select("*").eq("world_id", worldId),
    db.from("world_mail").select("*").eq("world_id", worldId),
    db.from("world_drafts").select("*").eq("world_id", worldId),
  ]);
  if (ev.error || mail.error || drafts.error)
    throw new Error(`world read failed: ${(ev.error ?? mail.error ?? drafts.error)?.message}`);
  return {
    events: (ev.data as EventRow[]).map(toEvent),
    mail: mail.data as MailRow[],
    drafts: drafts.data as (Draft & { world_id: string })[],
  };
}

export function worldCalendar(worldId: string): CalendarBackend {
  const db = admin();
  const one = async (id: string): Promise<EventRow> => {
    const { data } = await db.from("world_events").select("*").eq("world_id", worldId).eq("id", id).maybeSingle();
    if (!data) throw new Error(`no event with id ${id}`);
    return data as EventRow;
  };
  return {
    async listEvents(fromIso, toIso) {
      const from = new Date(fromIso).getTime();
      const to = new Date(toIso).getTime();
      if (Number.isNaN(from) || Number.isNaN(to)) throw new Error("from and to must be ISO dates");
      const { data, error } = await db.from("world_events").select("*").eq("world_id", worldId);
      if (error) throw new Error(error.message);
      return (data as EventRow[])
        .map(toEvent)
        .filter((e) => new Date(e.end).getTime() > from && new Date(e.start).getTime() < to)
        .sort((a, b) => a.start.localeCompare(b.start));
    },
    async createEvent(e) {
      const start = new Date(e.start);
      const end = new Date(e.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("start and end must be ISO dates");
      if (end <= start) throw new Error("end must be after start");
      const { data, error } = await db
        .from("world_events")
        .insert({ world_id: worldId, title: e.title, start: start.toISOString(), end: end.toISOString(), attendees: e.attendees ?? [] })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toEvent(data as EventRow);
    },
    async moveEvent(id, start, end) {
      await one(id);
      const { data, error } = await db
        .from("world_events")
        .update({ start: new Date(start).toISOString(), end: new Date(end).toISOString() })
        .eq("world_id", worldId)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return toEvent(data as EventRow);
    },
    async cancelEvent(id) {
      await one(id);
      const { error } = await db.from("world_events").delete().eq("world_id", worldId).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    },
  };
}

export function worldMail(worldId: string): MailBackend {
  const db = admin();
  const one = async (id: string): Promise<MailRow> => {
    const { data } = await db.from("world_mail").select("*").eq("world_id", worldId).eq("id", id).maybeSingle();
    if (!data) throw new Error(`no thread with id ${id}`);
    return data as MailRow;
  };
  const patch = async (id: string, change: Partial<MailRow>) => {
    const { data, error } = await db
      .from("world_mail")
      .update(change)
      .eq("world_id", worldId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toThread(data as MailRow);
  };
  return {
    async listThreads(query, max = 20) {
      const { data, error } = await db.from("world_mail").select("*").eq("world_id", worldId);
      if (error) throw new Error(error.message);
      const q = query?.trim().toLowerCase();
      return (data as MailRow[])
        .filter((r) => !r.archived)
        .filter((r) => !q || `${r.from} ${r.subject} ${r.snippet}`.toLowerCase().includes(q))
        .sort((a, b) => b.received_at.localeCompare(a.received_at))
        .slice(0, max)
        .map(toThread);
    },
    async readThread(id) {
      const r = await one(id);
      return { ...toThread(r), body: r.body };
    },
    async labelThread(id, label) {
      const r = await one(id);
      if (r.labels.includes(label)) return toThread(r);
      return patch(id, { labels: [...r.labels, label] });
    },
    async archiveThread(id) {
      const r = await one(id);
      return patch(id, { archived: true, labels: r.labels.filter((l) => l !== "INBOX") });
    },
    async createDraft(d) {
      const { data, error } = await db
        .from("world_drafts")
        .insert({ world_id: worldId, thread_id: d.thread_id ?? null, to: d.to, subject: d.subject, body: d.body })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const r = data as Draft;
      return { id: r.id, thread_id: r.thread_id, to: r.to, subject: r.subject, body: r.body };
    },
  };
}
