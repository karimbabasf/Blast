import type { Role, RunsIn } from "@/lib/market/types";

export const MODELS = [
  "anthropic/claude-sonnet-5.5",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "google/gemini-3.8-flash",
];

export const ROLE_TOOLS: Record<Role, string[]> = {
  calendar: ["list_events", "create_event", "move_event", "cancel_event"],
  email: ["list_threads", "read_thread", "label_thread", "archive_thread", "create_draft"],
  coding: ["read_file", "write_file", "run_tests"],
  research: ["web_search", "read_page"],
};

export const ROLE_LABEL: Record<Role, string> = {
  calendar: "Calendar",
  email: "Email",
  coding: "Coding",
  research: "Research",
};

const RUNS_IN: Record<RunsIn, string> = {
  blast: "Runs on Blast",
  sandbox: "Runs in a sandbox",
  builder_url: "Runs on the builder's server",
};

export function runsIn(r: RunsIn | string) {
  return RUNS_IN[r as RunsIn] ?? r;
}

// "anthropic/claude-sonnet-5.5" -> "Claude Sonnet 5.5", "openai/gpt-5-mini" -> "GPT-5 mini"
export function modelName(id: string) {
  const slug = id.split("/").pop() ?? id;
  if (slug.startsWith("gpt-")) {
    const [, ver, ...rest] = slug.split("-");
    return [`GPT-${ver}`, ...rest].join(" ");
  }
  return slug
    .split("-")
    .map((w) => (/^\d/.test(w) || !w ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function money(cents: number) {
  const d = cents / 100;
  return d >= 1 && Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const HM = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function when(iso: string) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso;
  return `${DAY.format(d)} ${HM.format(d)}`;
}

export function clock(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : HM.format(d);
}

function str(v: unknown) {
  return typeof v === "string" ? v : "";
}

function short(s: string, n = 40) {
  return s.length > n ? `${s.slice(0, n - 3)}...` : s;
}

// One human line for a tool call: "create_event Tue 15:30 Rakha sync".
export function summarize(name: string, input: unknown): string {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (name) {
    case "create_event":
      return [when(str(i.start)), str(i.title)].filter(Boolean).join(" ");
    case "move_event":
      return i.start ? `to ${when(str(i.start))}` : "";
    case "list_events": {
      const from = str(i.from ?? i.fromIso ?? i.start);
      const to = str(i.to ?? i.toIso ?? i.end);
      return from ? `${when(from)} to ${when(to)}` : "this week";
    }
    case "label_thread":
      return `"${str(i.label)}"`;
    case "create_draft":
      return [str(i.to), short(str(i.subject), 30)].filter(Boolean).join(", ");
    case "list_threads":
      return i.query ? `"${str(i.query)}"` : "inbox";
    default: {
      const parts = Object.values(i).filter((v) => typeof v === "string" || typeof v === "number");
      return short(parts.map(String).join(" "));
    }
  }
}

export function replyText(input: unknown, output: unknown) {
  for (const v of [output, input]) {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const t = o.text ?? o.reply ?? o.content;
      if (typeof t === "string") return t;
    }
  }
  return "";
}
