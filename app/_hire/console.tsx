"use client";

import { Archive, ChevronLeft, ChevronRight, Copy, Loader2, Mic, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CalEvent, Draft, EngagementMessage, MailThread } from "@/lib/market/types";
import { postJson } from "./db";
import { clock, modelName, money, summarize } from "./format";
import { useEngagement } from "./use-engagement";

type ChatReply = { reply: string; audio_url?: string | null; actions?: unknown[] };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function makeRecognition(): Recognition | null {
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function Console({ id, origin }: { id: string; origin: string }) {
  const view = useEngagement(id);
  const { engagement, agent } = view;
  const chat = view.messages.filter((m) => m.from !== "action");
  const actions = view.messages.filter((m) => m.from === "action");

  if (view.loaded && !engagement) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <p className="text-muted-foreground">No hire with this id.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{agent?.name ?? "Your agent"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {agent ? `${modelName(agent.model)} by ${agent.builder}` : "Loading"}
            {engagement?.status === "pending_payment" ? " · waiting for payment" : null}
          </p>
        </div>
        <GoogleStatus />
      </div>

      {/* Phones read chat, then the live account, then the log; wide screens put the live account on the right. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Chat id={id} messages={chat} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Week events={view.events} fresh={view.fresh} />
          <Inbox mail={view.mail} drafts={view.drafts} fresh={view.fresh} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
          <ActionLog actions={actions} metered={engagement?.actions ?? 0} priceCents={agent?.price_action_cents ?? 0} />
          <Endpoints id={id} origin={origin} />
        </div>
      </div>
    </main>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function GoogleStatus() {
  const [state, setState] = useState<{ connected: boolean; email?: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/google/status")
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then((d: { connected?: boolean; email?: string }) => {
        if (active) setState({ connected: d.connected === true, email: d.email });
      })
      .catch(() => {
        if (active) setState({ connected: false });
      });
    return () => {
      active = false;
    };
  }, []);
  if (!state) return null;
  return state.connected ? (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-success" />
      Working on {state.email ?? "your Google account"}
    </p>
  ) : (
    <a href="/api/google/connect" className="text-sm font-medium text-(--hire) hover:underline">
      Connect Google
    </a>
  );
}

function Chat({ id, messages }: { id: string; messages: EngagementMessage[] }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const rec = useRef<Recognition | null>(null);
  const transcript = useRef("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  async function send(body: string, voice: boolean) {
    const t = body.trim();
    if (!t || pending) return;
    setPending(t);
    setError(null);
    try {
      const res = await postJson<ChatReply>(`/api/engagements/${id}/chat`, { text: t, voice });
      if (voice && res.audio_url) new Audio(res.audio_url).play().catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent did not answer");
    } finally {
      setPending(null);
    }
  }

  function startTalking() {
    if (listening || pending) return;
    const r = makeRecognition();
    if (!r) {
      setError("Voice needs Chrome.");
      return;
    }
    transcript.current = "";
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript);
      transcript.current = parts.join(" ");
      setHeard(transcript.current);
    };
    r.onend = () => {
      setListening(false);
      setHeard("");
      rec.current = null;
      void send(transcript.current, true);
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  function stopTalking() {
    rec.current?.stop();
  }

  return (
    <Panel title="Talk to your agent">
      <div ref={scroller} className="h-80 space-y-3 overflow-y-auto px-4 py-4">
        {!messages.length && !pending ? (
          <p className="text-sm text-muted-foreground">
            Ask it to book something. Try &ldquo;Book 30 minutes with Rakha on Tuesday afternoon.&rdquo;
          </p>
        ) : null}
        {messages.map((m) => (
          <Bubble key={m.id} mine={m.from === "user"} text={m.text} />
        ))}
        {pending ? (
          <>
            {/* The route writes the user row first, so the echo replaces the optimistic bubble. */}
            {messages.at(-1)?.text === pending ? null : <Bubble mine text={pending} />}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Working
            </div>
          </>
        ) : null}
        {listening ? <Bubble mine text={heard || "Listening"} muted /> : null}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text, false);
          setText("");
        }}
        className="flex items-center gap-2 border-t p-3"
      >
        <button
          type="button"
          aria-label="Hold to talk"
          onPointerDown={startTalking}
          onPointerUp={stopTalking}
          onPointerLeave={stopTalking}
          className={`grid size-9 shrink-0 touch-none place-items-center rounded-full border transition-colors select-none ${
            listening ? "border-(--hire) bg-(--hire) text-white" : "hover:bg-muted"
          }`}
        >
          <Mic className="size-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Release to send" : "Message, or hold the mic"}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-(--hire)"
        />
        <Button type="submit" size="icon-lg" disabled={!text.trim() || !!pending} aria-label="Send" className="bg-(--hire) hover:bg-(--hire)/90">
          <Send />
        </Button>
      </form>
      {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
    </Panel>
  );
}

function Bubble({ mine, text, muted }: { mine?: boolean; text: string; muted?: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : ""}`}>
      <p
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
          mine ? "bg-(--hire) text-white" : "bg-muted"
        } ${muted ? "opacity-60" : ""}`}
      >
        {mine ? text : <Rich text={text} />}
      </p>
    </div>
  );
}

// Agents answer in light markdown; bold is the only mark worth keeping in a bubble.
function Rich({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold">{part}</strong> : part));
}

function actionLine(m: EngagementMessage) {
  const a = (m.action && typeof m.action === "object" ? m.action : {}) as Record<string, unknown>;
  const name = typeof a.name === "string" ? a.name : typeof a.tool === "string" ? a.tool : "";
  if (!name) return { name: "", detail: m.text };
  return { name, detail: summarize(name, a.input ?? a.args ?? a.arguments) || m.text };
}

function ActionLog({ actions, metered, priceCents }: { actions: EngagementMessage[]; metered: number; priceCents: number }) {
  const count = Math.max(metered, actions.length);
  return (
    <Panel
      title="Actions"
      aside={
        <span className="text-xs text-muted-foreground tabular-nums">
          <span className="text-foreground">{metered}</span> metered in Stripe
          {priceCents ? ` · ${money(count * priceCents)}` : null}
        </span>
      }
    >
      <ol className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {!actions.length ? <li className="font-sans text-sm text-muted-foreground">Nothing yet.</li> : null}
        {[...actions].reverse().map((m) => {
          const { name, detail } = actionLine(m);
          return (
            <li key={m.id} className="flex gap-3 py-0.5 animate-in fade-in duration-300">
              <span className="shrink-0 text-muted-foreground tabular-nums">{clock(m.created_at)}</span>
              <span className="min-w-0">
                {name ? <span className="text-(--hire)">{name}</span> : null} {detail}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function Endpoints({ id, origin }: { id: string; origin: string }) {
  const rows = [
    { label: "Chat API", value: `POST ${origin}/api/engagements/${id}/chat` },
    { label: "MCP", value: `claude mcp add --transport http blast ${origin}/api/mcp` },
  ];
  return (
    <Panel title="For other agents">
      <dl className="space-y-3 px-4 py-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="mt-1 flex items-start gap-2">
              <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all">{r.value}</code>
              <button
                type="button"
                aria-label={`Copy ${r.label}`}
                onClick={() => navigator.clipboard?.writeText(r.value)}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy className="size-3.5" />
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

const START_HOUR = 8;
const END_HOUR = 19;
const HOUR_PX = 36;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function mondayOf(d: Date) {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  const dow = m.getDay();
  // A weekend shows the coming week.
  m.setDate(m.getDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow));
  return m;
}

function Week({ events, fresh }: { events: CalEvent[]; fresh: Set<string> }) {
  const [offset, setOffset] = useState(0);
  const [base] = useState(() => mondayOf(new Date()).getTime());
  const monday = new Date(base);
  monday.setDate(monday.getDate() + offset * 7);
  const days = DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const range = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${days[4].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <Panel
      title="Calendar"
      aside={
        <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <button type="button" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)} className="rounded p-1 hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          {range}
          <button type="button" aria-label="Next week" onClick={() => setOffset((o) => o + 1)} className="rounded p-1 hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[340px] grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] px-2 pb-3">
          <div />
          {days.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs text-muted-foreground">
              {DAYS[i]} <span className="text-foreground tabular-nums">{d.getDate()}</span>
            </div>
          ))}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums" style={{ top: i * HOUR_PX }}>
                {i ? `${h}:00` : ""}
              </div>
            ))}
          </div>
          {days.map((d, i) => {
            const dayEvents = events.filter((e) => new Date(e.start).toDateString() === d.toDateString());
            return (
              <div key={i} className="relative border-l" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, j) => (
                  <div key={h} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: j * HOUR_PX }} />
                ))}
                {dayEvents.map((e) => (
                  <EventBlock key={e.id} event={e} fresh={fresh.has(e.id)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function EventBlock({ event, fresh }: { event: CalEvent; fresh: boolean }) {
  const s = new Date(event.start);
  const e = new Date(event.end);
  const startH = Math.max(START_HOUR, s.getHours() + s.getMinutes() / 60);
  const endH = Math.min(END_HOUR, e.getHours() + e.getMinutes() / 60);
  if (endH <= START_HOUR || startH >= END_HOUR) return null;
  return (
    <div
      title={`${event.title} ${clock(event.start)} to ${clock(event.end)}`}
      className={`absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight transition-colors duration-700 ${
        fresh ? "border-(--hire) bg-(--hire) text-white animate-in fade-in zoom-in-95" : "border-(--hire)/25 bg-(--hire-soft)"
      }`}
      style={{ top: (startH - START_HOUR) * HOUR_PX + 1, height: Math.max(18, (endH - startH) * HOUR_PX - 2) }}
    >
      <div className="truncate font-medium">{event.title}</div>
      <div className={`tabular-nums ${fresh ? "text-white/80" : "text-muted-foreground"}`}>{clock(event.start)}</div>
    </div>
  );
}

function Inbox({ mail, drafts, fresh }: { mail: MailThread[]; drafts: Draft[]; fresh: Set<string> }) {
  const open = mail.filter((m) => !m.archived).length;
  return (
    <Panel title="Inbox" aside={<span className="text-xs text-muted-foreground tabular-nums">{open} open</span>}>
      <ul className="max-h-96 divide-y overflow-y-auto">
        {!mail.length ? <li className="px-4 py-3 text-sm text-muted-foreground">No mail synced yet.</li> : null}
        {mail.map((m) => (
          <li
            key={m.id}
            className={`px-4 py-2.5 transition-colors duration-700 ${fresh.has(m.id) ? "bg-(--hire-soft)" : ""} ${m.archived ? "opacity-50" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{m.from.replace(/<.*>/, "").trim() || m.from}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {new Date(m.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="min-w-0 truncate text-sm">{m.subject}</span>
              {m.archived ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Archive className="size-3" /> Archived
                </span>
              ) : null}
              {m.labels
                .filter((l) => !/^(INBOX|UNREAD|CATEGORY_|IMPORTANT$|SENT|STARRED)/.test(l))
                .map((l) => (
                  <span key={l} className="shrink-0 rounded-full bg-(--hire-soft) px-2 py-px text-xs text-(--hire)">
                    {l}
                  </span>
                ))}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.snippet}</p>
          </li>
        ))}
      </ul>
      {drafts.length ? (
        <div className="border-t">
          <h3 className="px-4 pt-3 text-xs font-medium text-muted-foreground">Drafts by your agent</h3>
          <ul className="space-y-2 px-4 py-3">
            {drafts.map((d) => (
              <li
                key={d.id}
                className={`rounded-lg border px-3 py-2 transition-colors duration-700 ${fresh.has(d.id) ? "border-(--hire) bg-(--hire-soft)" : ""}`}
              >
                <div className="truncate text-sm">
                  <span className="text-muted-foreground">To</span> {d.to}
                  <span className="text-muted-foreground"> · </span>
                  {d.subject}
                </div>
                <p className="mt-1 line-clamp-3 text-xs whitespace-pre-wrap text-muted-foreground">{d.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
