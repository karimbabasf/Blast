// The fixed week every tryout starts from: Xochitl Coffee's coming Mon to Fri, in business time.

import type { CalEvent, MailThread } from "@/lib/market/types";

export const TZ = "America/Los_Angeles";
// Pacific daylight time until Nov 1. Hardcoded on purpose: the demo week sits inside it.
const OFFSET = "-07:00";

function laDate(d: Date): { ymd: string; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, dow };
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The coming Monday, as YYYY-MM-DD in business time.
export function weekMonday(now = new Date()): string {
  const { ymd, dow } = laDate(now);
  return addDays(ymd, (8 - dow) % 7 || 7);
}

// Day 0 is Monday. Hours are business time.
export function at(day: number, hhmm: string, now = new Date()): string {
  return new Date(`${addDays(weekMonday(now), day)}T${hhmm}:00${OFFSET}`).toISOString();
}

// Day-of-week index and minutes after midnight in business time.
export function laClock(iso: string): { ymd: string; minutes: number } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { ymd: laDate(d).ymd, minutes: get("hour") * 60 + get("minute") };
}

export function tuesday(now = new Date()): string {
  return addDays(weekMonday(now), 1);
}

export function nowLine(now = new Date()): string {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    dateStyle: "full",
    timeStyle: "short",
  }).format(now);
  return `It is now ${s} in ${TZ} (UTC${OFFSET}). Use that timezone for every time you read or write, and write times as ISO 8601 with the offset.`;
}

export function seedEvents(now = new Date()): CalEvent[] {
  const e = (id: string, title: string, day: number, s: string, en: string, attendees: string[] = []) => ({
    id,
    title,
    start: at(day, s, now),
    end: at(day, en, now),
    attendees,
  });
  return [
    e("ev-mon-standup", "Team standup", 0, "09:00", "09:30", ["staff@xochitl.coffee"]),
    e("ev-mon-roaster", "Roaster tasting", 0, "13:00", "14:30", ["beans@losaltosroasters.com"]),
    e("ev-tue-standup", "Team standup", 1, "09:00", "09:30", ["staff@xochitl.coffee"]),
    e("ev-tue-lunch", "Lunch with Marco", 1, "12:00", "13:00", ["marco@ferrybuilding.org"]),
    e("ev-tue-supplier", "Supplier call", 1, "14:00", "15:00", ["orders@pacificmilk.com"]),
    e("ev-tue-interview", "Barista interview", 1, "16:00", "16:45", ["jordan.lee@gmail.com"]),
    e("ev-wed-inspect", "Health inspection", 2, "10:00", "11:00"),
    e("ev-thu-accountant", "Accountant review", 3, "11:00", "12:00", ["books@baytax.com"]),
    e("ev-fri-payroll", "Payroll run", 4, "15:00", "15:30"),
  ];
}

export type SeedThread = MailThread & { body: string };

export const NEWSLETTER_IDS = ["th-brew", "th-sca", "th-square"];
export const GRACE_ID = "th-grace";
export const GRACE_EMAIL = "grace@kasten.vc";

export function seedMail(now = new Date()): SeedThread[] {
  const t = (
    id: string,
    from: string,
    subject: string,
    body: string,
    hoursAgo: number,
  ): SeedThread => ({
    id,
    from,
    subject,
    snippet: body.slice(0, 110),
    labels: ["INBOX"],
    archived: false,
    received_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    body,
  });
  return [
    t("th-brew", "Morning Brew <crew@morningbrew.com>", "The market had a wild Friday",
      "Good morning. Stocks swung hard on Friday, a coffee chain IPO popped 40%, and here is everything else you missed this week. Unsubscribe anytime.", 3),
    t("th-sca", "Specialty Coffee Weekly <news@sca.coffee>", "This week: anaerobic naturals and the price of green",
      "Issue 212. Green coffee prices are up again, three roasters on anaerobic processing, and the events calendar for October. You are receiving this because you subscribed.", 20),
    t("th-square", "Square Seller Digest <digest@squareup.com>", "5 ways to grow your cafe this fall",
      "Tips for small businesses: loyalty programs, seasonal menus, and how to use Square Marketing. Manage your email preferences here.", 30),
    t(GRACE_ID, `Grace Kasten <${GRACE_EMAIL}>`, "Xochitl Coffee: meet Thursday?",
      "Hi, I loved what you are building with Xochitl Coffee. I would like to talk about your seed round. Could we meet Thursday at 3pm? Happy to come to the shop. Best, Grace", 5),
    t("th-complaint", "Dana Ruiz <dana.ruiz@gmail.com>", "Cold latte and a 20 minute wait",
      "I came in Saturday morning and waited 20 minutes for an oat latte that arrived cold. I have been a regular for two years and this is the second time this month. Please do better.", 8),
    t("th-invoice", "Pacific Milk Co <billing@pacificmilk.com>", "Invoice #4471 due October 15",
      "Attached is invoice #4471 for $1,284.50 covering September dairy deliveries. Payment is due October 15. Thank you for your business.", 26),
    t("th-shift", "Jamie Chen <jamie@xochitl.coffee>", "Can I swap my Wednesday shift?",
      "Hey, my sister is visiting Wednesday. Could I swap my opening shift with Priya? She already said yes. Thanks!", 10),
    t("th-catering", "Lena Park <lena@brightline.io>", "Catering order for 40 people",
      "Hi, we would like coffee and pastries for 40 people at our office on October 14 at 9am. Can you send a quote?", 14),
    t("th-landlord", "Harbor Property <leasing@harborprop.com>", "Window repair scheduled",
      "Our contractor will repair the front window on Monday between 7 and 8am, before you open. No action needed.", 40),
    t("th-rakha", "Rakha <rakha@xochitl.coffee>", "Menu photos are ready",
      "Uploaded the new menu photos to the shared drive. Let me know which ones you want for the site.", 2),
  ];
}
