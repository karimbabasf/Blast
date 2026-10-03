// The hired agent's live backends on the connected Google account, fenced to demo data only: one secondary
// calendar named "Blast demo" (never primary) and the Gmail threads labelled "Blast demo". Nothing else in the
// account is listed, read or changed. Every write also refreshes the live_* mirror rows so the app streams the
// change. Without a connected account the same interfaces run on a Supabase demo account kept in the live_*
// tables, so the demo never breaks. Mail has no send function on purpose: the agent can only draft.

import { account, accessToken, type Account } from "@/lib/google/oauth";
import type { CalEvent, CalendarBackend, Draft, MailBackend, MailThread } from "@/lib/market/types";
import { seedEvents, seedMail, TZ } from "@/lib/roles/seed";
import { admin } from "@/lib/supabase-admin";

export const DEMO_NAME = "Blast demo";

const CALS = "https://www.googleapis.com/calendar/v3";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const SYSTEM_LABELS = ["INBOX", "IMPORTANT", "STARRED", "UNREAD"];
// Demo events never carry alarms: the owner's Mac fires full-screen alerts on events that do.
const NO_REMINDERS = { useDefault: false, overrides: [] };

async function gfetch<T>(acct: Account, url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await accessToken(acct);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`Google ${init.method ?? "GET"} ${url.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

type Scoped = Account & { calendar_id: string; label_id: string };

// Finds or creates the "Blast demo" calendar and label, and stores their ids on the account row.
export async function demoScope(acct: Account): Promise<Scoped> {
  let { calendar_id, label_id } = acct;
  if (!calendar_id) {
    const { items = [] } = await gfetch<{ items?: { id: string; summary: string; primary?: boolean }[] }>(
      acct,
      `${CALS}/users/me/calendarList?minAccessRole=owner`,
    );
    calendar_id =
      items.find((c) => c.summary === DEMO_NAME && !c.primary)?.id ??
      (await gfetch<{ id: string }>(acct, `${CALS}/calendars`, { method: "POST", body: { summary: DEMO_NAME, timeZone: TZ } })).id;
  }
  if (!label_id) {
    const { labels = [] } = await gfetch<{ labels?: GLabel[] }>(acct, `${GMAIL}/labels`);
    label_id =
      labels.find((l) => l.name === DEMO_NAME)?.id ??
      (await gfetch<GLabel>(acct, `${GMAIL}/labels`, {
        method: "POST",
        body: { name: DEMO_NAME, labelListVisibility: "labelShow", messageListVisibility: "show" },
      })).id;
  }
  if (calendar_id !== acct.calendar_id || label_id !== acct.label_id) {
    check((await admin().from("google_accounts").update({ calendar_id, label_id }).eq("id", acct.id)).error, "google_accounts scope update failed");
  }
  if (calendar_id === "primary" || calendar_id === acct.email) throw new Error("Refusing to use the primary calendar");
  return { ...acct, calendar_id, label_id };
}

// ---------- Calendar ----------

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
};

function iso(t: { dateTime?: string; date?: string }): string {
  // All-day events carry a bare date; read it as midnight in business time.
  return new Date(t.dateTime ?? `${t.date}T00:00:00-07:00`).toISOString();
}

function toCalEvent(e: GEvent): CalEvent {
  return {
    id: e.id,
    title: e.summary ?? "(no title)",
    start: iso(e.start),
    end: iso(e.end),
    attendees: (e.attendees ?? []).map((a) => a.email),
  };
}

async function mirrorEvent(e: CalEvent) {
  const { error } = await admin()
    .from("live_events")
    .upsert({ ...e, synced_at: new Date().toISOString() });
  check(error, "live_events upsert failed");
}

function calUrl(acct: Scoped, path = ""): string {
  return `${CALS}/calendars/${encodeURIComponent(acct.calendar_id)}/events${path}`;
}

async function googleEvents(acct: Scoped, fromIso: string, toIso: string): Promise<CalEvent[]> {
  const q = new URLSearchParams({
    timeMin: new Date(fromIso).toISOString(),
    timeMax: new Date(toIso).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const { items = [] } = await gfetch<{ items?: GEvent[] }>(acct, `${calUrl(acct)}?${q}`);
  return items.filter((e) => e.status !== "cancelled").map(toCalEvent);
}

export async function createDemoEvent(acct: Scoped, e: { title: string; start: string; end: string; attendees?: string[] }) {
  const made = await gfetch<GEvent>(acct, `${calUrl(acct)}?sendUpdates=none`, {
    method: "POST",
    body: {
      summary: e.title,
      start: { dateTime: e.start, timeZone: TZ },
      end: { dateTime: e.end, timeZone: TZ },
      attendees: (e.attendees ?? []).map((email) => ({ email })),
      reminders: NO_REMINDERS,
    },
  });
  return toCalEvent(made);
}

function googleCalendar(acct: Scoped): CalendarBackend {
  return {
    listEvents: (fromIso, toIso) => googleEvents(acct, fromIso, toIso),
    async createEvent(e) {
      const ev = await createDemoEvent(acct, e);
      await mirrorEvent(ev);
      return ev;
    },
    async moveEvent(id, start, end) {
      const e = await gfetch<GEvent>(acct, `${calUrl(acct, `/${encodeURIComponent(id)}`)}?sendUpdates=none`, {
        method: "PATCH",
        body: { start: { dateTime: start, timeZone: TZ }, end: { dateTime: end, timeZone: TZ }, reminders: NO_REMINDERS },
      });
      const ev = toCalEvent(e);
      await mirrorEvent(ev);
      return ev;
    },
    async cancelEvent(id) {
      await gfetch(acct, `${calUrl(acct, `/${encodeURIComponent(id)}`)}?sendUpdates=none`, { method: "DELETE" });
      const { error } = await admin().from("live_events").delete().eq("id", id);
      check(error, "live_events delete failed");
      return { id };
    },
  };
}

// ---------- Gmail (only threads labelled "Blast demo") ----------

type GHeader = { name: string; value: string };
type GPart = { mimeType?: string; body?: { data?: string }; parts?: GPart[]; headers?: GHeader[] };
type GMessage = { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: GPart };
type GThread = { id: string; messages?: GMessage[] };
type GLabel = { id: string; name: string; type?: string };

function header(m: GMessage | undefined, name: string): string {
  return m?.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function plainText(p: GPart | undefined): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return decode(p.body.data);
  for (const part of p.parts ?? []) {
    const t = plainText(part);
    if (t) return t;
  }
  if (p.mimeType === "text/html" && p.body?.data) return decode(p.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

async function labelNames(acct: Account): Promise<Map<string, string>> {
  const { labels = [] } = await gfetch<{ labels?: GLabel[] }>(acct, `${GMAIL}/labels`);
  return new Map(labels.map((l) => [l.id, l.type === "system" ? l.id : l.name]));
}

function threadLabelIds(t: GThread): Set<string> {
  return new Set((t.messages ?? []).flatMap((m) => m.labelIds ?? []));
}

function toMailThread(acct: Scoped, t: GThread, names: Map<string, string>): MailThread {
  const msgs = t.messages ?? [];
  const first = msgs[0];
  const last = msgs[msgs.length - 1];
  const ids = threadLabelIds(t);
  const labels = [...ids]
    .filter((id) => id !== acct.label_id && !id.startsWith("CATEGORY_"))
    .map((id) => names.get(id) ?? id);
  return {
    id: t.id,
    from: header(first, "From"),
    subject: header(first, "Subject") || "(no subject)",
    snippet: last?.snippet ?? "",
    labels,
    archived: !ids.has("INBOX"),
    received_at: new Date(Number(last?.internalDate ?? Date.now())).toISOString(),
  };
}

// Fetches a thread and refuses it unless it carries the demo label, so the agent can never reach other mail.
async function demoThread(acct: Scoped, id: string, format: "metadata" | "full"): Promise<GThread> {
  const q = format === "full" ? "format=full" : "format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID";
  const t = await gfetch<GThread>(acct, `${GMAIL}/threads/${encodeURIComponent(id)}?${q}`);
  if (!threadLabelIds(t).has(acct.label_id)) throw new Error(`No thread ${id}`);
  return t;
}

async function googleThreads(acct: Scoped, query: string, max: number): Promise<MailThread[]> {
  const q = new URLSearchParams({ q: `${query} -in:spam -in:trash`.trim(), labelIds: acct.label_id, maxResults: String(Math.min(Math.max(max, 1), 50)) });
  const [{ threads = [] }, names] = await Promise.all([
    gfetch<{ threads?: { id: string }[] }>(acct, `${GMAIL}/threads?${q}`),
    labelNames(acct),
  ]);
  const full = await Promise.all(threads.map((t) => demoThread(acct, t.id, "metadata")));
  return full.map((t) => toMailThread(acct, t, names));
}

async function mirrorThread(t: MailThread) {
  const { error } = await admin()
    .from("live_mail")
    .upsert({ ...t, synced_at: new Date().toISOString() });
  check(error, "live_mail upsert failed");
}

async function mirrorDraft(d: Draft) {
  const { error } = await admin().from("live_drafts").upsert(d);
  check(error, "live_drafts upsert failed");
}

async function modify(acct: Scoped, id: string, change: { addLabelIds?: string[]; removeLabelIds?: string[] }) {
  await demoThread(acct, id, "metadata");
  await gfetch(acct, `${GMAIL}/threads/${encodeURIComponent(id)}/modify`, { method: "POST", body: change });
  const t = toMailThread(acct, await demoThread(acct, id, "metadata"), await labelNames(acct));
  await mirrorThread(t);
  return t;
}

async function labelId(acct: Scoped, label: string): Promise<string> {
  const name = label.trim();
  const system = SYSTEM_LABELS.find((s) => s === name.toUpperCase());
  if (system) return system;
  const { labels = [] } = await gfetch<{ labels?: GLabel[] }>(acct, `${GMAIL}/labels`);
  const found = labels.find((l) => l.type !== "system" && l.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  const made = await gfetch<GLabel>(acct, `${GMAIL}/labels`, {
    method: "POST",
    body: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  return made.id;
}

function rawMessage(h: Record<string, string>, body: string): string {
  const head = Object.entries(h)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
  const msg = `${head}\r\nContent-Type: text/plain; charset="UTF-8"\r\nMIME-Version: 1.0\r\n\r\n${body}`;
  return Buffer.from(msg).toString("base64url");
}

function googleMail(acct: Scoped): MailBackend {
  return {
    listThreads: (query, max = 25) => googleThreads(acct, query?.trim() || "in:inbox", max),
    async readThread(id) {
      const [t, names] = await Promise.all([demoThread(acct, id, "full"), labelNames(acct)]);
      const body = (t.messages ?? [])
        .map((m) => `From: ${header(m, "From")}\n${plainText(m.payload).trim()}`)
        .join("\n\n---\n\n");
      return { ...toMailThread(acct, t, names), body };
    },
    async labelThread(id, label) {
      return modify(acct, id, { addLabelIds: [await labelId(acct, label)] });
    },
    archiveThread: (id) => modify(acct, id, { removeLabelIds: ["INBOX"] }),
    async createDraft({ thread_id, to, subject, body }) {
      let inReplyTo = "";
      if (thread_id) {
        const msgs = (await demoThread(acct, thread_id, "metadata")).messages ?? [];
        inReplyTo = header(msgs[msgs.length - 1], "Message-ID");
      }
      const raw = rawMessage({ To: to, Subject: subject, "In-Reply-To": inReplyTo, References: inReplyTo }, body);
      const made = await gfetch<{ id: string }>(acct, `${GMAIL}/drafts`, {
        method: "POST",
        body: { message: { raw, ...(thread_id ? { threadId: thread_id } : {}) } },
      });
      const d: Draft = { id: made.id, thread_id: thread_id ?? null, to, subject, body };
      await mirrorDraft(d);
      return d;
    },
  };
}

// ---------- Demo account fallback (live_* tables only) ----------

let seeded: Promise<void> | null = null;

// Seeds the demo account once, only when the mirror is empty, so it never overwrites a real sync.
function ensureDemoSeed(): Promise<void> {
  seeded ??= (async () => {
    const db = admin();
    const [{ count: events }, { count: mail }] = await Promise.all([
      db.from("live_events").select("id", { count: "exact", head: true }),
      db.from("live_mail").select("id", { count: "exact", head: true }),
    ]);
    if (!events) check((await db.from("live_events").upsert(seedEvents())).error, "demo events seed failed");
    if (!mail) check((await db.from("live_mail").upsert(seedMail())).error, "demo mail seed failed");
  })().catch((e: unknown) => {
    seeded = null;
    throw e;
  });
  return seeded;
}

type LiveMailRow = MailThread & { body: string | null };

function stripMail(r: LiveMailRow): MailThread {
  return {
    id: r.id,
    from: r.from,
    subject: r.subject,
    snippet: r.snippet,
    labels: r.labels,
    archived: r.archived,
    received_at: r.received_at,
  };
}

function demoCalendar(): CalendarBackend {
  const cols = "id, title, start, end, attendees";
  return {
    async listEvents(fromIso, toIso) {
      const { data, error } = await admin()
        .from("live_events")
        .select(cols)
        .lt("start", new Date(toIso).toISOString())
        .gt("end", new Date(fromIso).toISOString())
        .order("start");
      check(error, "live_events read failed");
      return (data ?? []) as CalEvent[];
    },
    async createEvent({ title, start, end, attendees = [] }) {
      const ev: CalEvent = {
        id: `ev-${crypto.randomUUID().slice(0, 8)}`,
        title,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        attendees,
      };
      await mirrorEvent(ev);
      return ev;
    },
    async moveEvent(id, start, end) {
      const { data, error } = await admin()
        .from("live_events")
        .update({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), synced_at: new Date().toISOString() })
        .eq("id", id)
        .select(cols)
        .maybeSingle();
      check(error, "live_events move failed");
      if (!data) throw new Error(`No event ${id}`);
      return data as CalEvent;
    },
    async cancelEvent(id) {
      const { data, error } = await admin().from("live_events").delete().eq("id", id).select("id");
      check(error, "live_events delete failed");
      if (!data?.length) throw new Error(`No event ${id}`);
      return { id };
    },
  };
}

function demoMail(): MailBackend {
  async function row(id: string): Promise<LiveMailRow> {
    const { data, error } = await admin().from("live_mail").select("*").eq("id", id).maybeSingle();
    check(error, "live_mail read failed");
    if (!data) throw new Error(`No thread ${id}`);
    return data as LiveMailRow;
  }
  async function save(r: LiveMailRow, change: Partial<MailThread>): Promise<MailThread> {
    const next = { ...r, ...change, synced_at: new Date().toISOString() };
    check((await admin().from("live_mail").update(next).eq("id", r.id)).error, "live_mail update failed");
    return stripMail(next);
  }
  return {
    async listThreads(query, max = 25) {
      let q = admin().from("live_mail").select("*").order("received_at", { ascending: false }).limit(max);
      const text = query?.trim();
      if (!text || /^in:inbox$/i.test(text)) q = q.eq("archived", false);
      else q = q.or(`subject.ilike.%${text.replace(/[%,()]/g, " ")}%,from.ilike.%${text.replace(/[%,()]/g, " ")}%`);
      const { data, error } = await q;
      check(error, "live_mail read failed");
      return ((data ?? []) as LiveMailRow[]).map(stripMail);
    },
    async readThread(id) {
      const r = await row(id);
      return { ...stripMail(r), body: r.body ?? r.snippet };
    },
    async labelThread(id, label) {
      const r = await row(id);
      const name = SYSTEM_LABELS.find((s) => s === label.trim().toUpperCase()) ?? label.trim();
      return save(r, { labels: r.labels.includes(name) ? r.labels : [...r.labels, name] });
    },
    async archiveThread(id) {
      const r = await row(id);
      return save(r, { archived: true, labels: r.labels.filter((l) => l !== "INBOX") });
    },
    async createDraft({ thread_id, to, subject, body }) {
      const d: Draft = { id: `dr-${crypto.randomUUID().slice(0, 8)}`, thread_id: thread_id ?? null, to, subject, body };
      await mirrorDraft(d);
      return d;
    },
  };
}

// ---------- Public seams ----------

export async function liveCalendar(): Promise<CalendarBackend> {
  const acct = await account();
  if (acct) return googleCalendar(await demoScope(acct));
  await ensureDemoSeed();
  return demoCalendar();
}

export async function liveMail(): Promise<MailBackend> {
  const acct = await account();
  if (acct) return googleMail(await demoScope(acct));
  await ensureDemoSeed();
  return demoMail();
}

// Pulls the demo calendar's next 14 days and the latest 25 demo-labelled threads (archived ones too) into the
// live_* mirror; deletes rows that disappeared.
export async function syncLive(): Promise<{ email: string; events: number; threads: number; removed: number }> {
  const found = await account();
  if (!found) throw new Error("No Google account connected");
  const acct = await demoScope(found);
  const now = new Date();
  const [events, threads] = await Promise.all([
    googleEvents(acct, now.toISOString(), new Date(now.getTime() + 14 * 86_400_000).toISOString()),
    googleThreads(acct, "", 25),
  ]);
  const db = admin();
  const synced_at = now.toISOString();
  if (events.length) check((await db.from("live_events").upsert(events.map((e) => ({ ...e, synced_at })))).error, "live_events sync failed");
  if (threads.length) check((await db.from("live_mail").upsert(threads.map((t) => ({ ...t, body: null, synced_at })))).error, "live_mail sync failed");
  const goneEvents = await db.from("live_events").delete().lt("synced_at", synced_at).select("id");
  const goneMail = await db.from("live_mail").delete().lt("synced_at", synced_at).select("id");
  check(goneEvents.error ?? goneMail.error, "live mirror cleanup failed");
  return {
    email: acct.email,
    events: events.length,
    threads: threads.length,
    removed: (goneEvents.data?.length ?? 0) + (goneMail.data?.length ?? 0),
  };
}
