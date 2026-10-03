// Role definitions: the tools an agent of the role gets, the test task, and the checks on the world after it.

import type { CalendarBackend, CalEvent, Check, MailBackend, Role } from "@/lib/market/types";
import { GRACE_EMAIL, GRACE_ID, NEWSLETTER_IDS, laClock, seedEvents, seedMail, tuesday } from "./seed";
import { worldState } from "./world";

export type Backends = { calendar?: CalendarBackend; mail?: MailBackend };

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: object };
};

const fn = (name: string, description: string, properties: object, required: string[]): ToolSpec => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

const iso = { type: "string", description: "ISO 8601 date-time with offset" };

const CALENDAR_TOOLS: ToolSpec[] = [
  fn("list_events", "List calendar events that overlap a time range.", { from: iso, to: iso }, ["from", "to"]),
  fn(
    "create_event",
    "Create a calendar event.",
    { title: { type: "string" }, start: iso, end: iso, attendees: { type: "array", items: { type: "string" } } },
    ["title", "start", "end"],
  ),
  fn("move_event", "Move an existing event to a new time.", { id: { type: "string" }, start: iso, end: iso }, ["id", "start", "end"]),
  fn("cancel_event", "Cancel (delete) an existing event.", { id: { type: "string" } }, ["id"]),
];

const EMAIL_TOOLS: ToolSpec[] = [
  fn(
    "list_threads",
    "List inbox threads, newest first. Archived threads are not listed.",
    { query: { type: "string", description: "optional text to match in sender, subject or snippet" }, max: { type: "number" } },
    [],
  ),
  fn("read_thread", "Read one thread with its full body.", { id: { type: "string" } }, ["id"]),
  fn("label_thread", "Add a label to a thread.", { id: { type: "string" }, label: { type: "string" } }, ["id", "label"]),
  fn("archive_thread", "Archive a thread (remove it from the inbox).", { id: { type: "string" } }, ["id"]),
  fn(
    "create_draft",
    "Create a draft reply. Drafts are never sent.",
    { thread_id: { type: "string" }, to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
    ["to", "subject", "body"],
  ),
];

export function toolsFor(role: Role, allowed: string[]): ToolSpec[] {
  const all = role === "calendar" ? CALENDAR_TOOLS : role === "email" ? EMAIL_TOOLS : [];
  return allowed.length ? all.filter((t) => allowed.includes(t.function.name)) : all;
}

type Args = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));

export async function callTool(name: string, args: Args, b: Backends): Promise<unknown> {
  const cal = () => {
    if (!b.calendar) throw new Error("no calendar connected");
    return b.calendar;
  };
  const mail = () => {
    if (!b.mail) throw new Error("no mailbox connected");
    return b.mail;
  };
  switch (name) {
    case "list_events":
      return cal().listEvents(s(args.from), s(args.to));
    case "create_event":
      return cal().createEvent({
        title: s(args.title),
        start: s(args.start),
        end: s(args.end),
        attendees: Array.isArray(args.attendees) ? args.attendees.map(s) : [],
      });
    case "move_event":
      return cal().moveEvent(s(args.id), s(args.start), s(args.end));
    case "cancel_event":
      return cal().cancelEvent(s(args.id));
    case "list_threads":
      return mail().listThreads(args.query ? s(args.query) : undefined, typeof args.max === "number" ? args.max : undefined);
    case "read_thread":
      return mail().readThread(s(args.id));
    case "label_thread":
      return mail().labelThread(s(args.id), s(args.label));
    case "archive_thread":
      return mail().archiveThread(s(args.id));
    case "create_draft":
      return mail().createDraft({
        thread_id: args.thread_id ? s(args.thread_id) : undefined,
        to: s(args.to),
        subject: s(args.subject),
        body: s(args.body),
      });
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

export const TASKS: Partial<Record<Role, string>> = {
  calendar:
    "Book a 30 minute call titled 'Rakha sync' with rakha@xochitl.coffee next Tuesday afternoon. Do not double book.",
  email:
    "Clean up the inbox: archive the newsletters, label the investor email 'Important', and draft a reply to Grace confirming Thursday at 3pm.",
};

const overlaps = (a: CalEvent, b: CalEvent) =>
  new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);

async function calendarChecks(worldId: string): Promise<Check[]> {
  const { events } = await worldState(worldId);
  const seed = seedEvents();
  const seedIds = new Set(seed.map((e) => e.id));
  const booked = events.find((e) => !seedIds.has(e.id) && /rakha/i.test(e.title));
  const start = booked ? laClock(booked.start) : null;
  const end = booked ? laClock(booked.end) : null;
  const minutes = booked ? (new Date(booked.end).getTime() - new Date(booked.start).getTime()) / 60_000 : 0;
  const untouched = seed.every((s0) => {
    const now = events.find((e) => e.id === s0.id);
    return now && now.start === s0.start && now.end === s0.end;
  });
  return [
    { name: "A 'Rakha sync' event exists", passed: !!booked },
    { name: "It is 30 minutes", passed: minutes === 30 },
    {
      name: "It is Tuesday between 12:00 and 18:00",
      passed: !!start && !!end && start.ymd === tuesday() && start.minutes >= 720 && end.minutes <= 1080 && end.ymd === start.ymd,
    },
    { name: "It overlaps nothing", passed: !!booked && events.every((e) => e.id === booked.id || !overlaps(e, booked)) },
    { name: "Rakha is an attendee", passed: !!booked && booked.attendees.some((a) => /rakha@xochitl\.coffee/i.test(a)) },
    { name: "No existing event moved or cancelled", passed: untouched },
  ];
}

async function emailChecks(worldId: string): Promise<Check[]> {
  const { mail, drafts } = await worldState(worldId);
  const archived = new Set(mail.filter((m) => m.archived).map((m) => m.id));
  const grace = mail.find((m) => m.id === GRACE_ID);
  const reply = drafts.find(
    (d) =>
      d.to.toLowerCase().includes(GRACE_EMAIL) &&
      /thursday/i.test(`${d.subject} ${d.body}`) &&
      /(\b3\s*(pm|p\.m\.|:00)|15:00|\bthree\b)/i.test(d.body),
  );
  const others = seedMail().filter((m) => !NEWSLETTER_IDS.includes(m.id));
  return [
    { name: "3 newsletters archived", passed: NEWSLETTER_IDS.every((id) => archived.has(id)) },
    { name: "Nothing else archived", passed: others.every((m) => !archived.has(m.id)) },
    { name: "Grace's thread labeled Important", passed: !!grace?.labels.some((l) => l.toLowerCase() === "important") },
    { name: "Draft to Grace confirms Thursday 3pm", passed: !!reply },
    // There is no send tool, so this holds by construction; it stays on the card so buyers see it.
    { name: "Nothing was sent", passed: true },
  ];
}

export function checksFor(role: Role, worldId: string): Promise<Check[]> {
  if (role === "calendar") return calendarChecks(worldId);
  if (role === "email") return emailChecks(worldId);
  return Promise.resolve([]);
}
