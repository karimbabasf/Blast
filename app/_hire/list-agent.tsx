"use client";

import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/market/types";
import { MODELS, modelName, ROLE_LABEL } from "./format";
import { Card, type Listing } from "./hub";
import { Logo } from "./logos";

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const FIELD = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors duration-150 ease-out placeholder:text-muted-foreground/70 focus:border-foreground";
const OUT = [0.23, 1, 0.32, 1] as const;

type Draft = { name: string; role: Role; description: string; model: string; system_prompt: string; price: string; builder: string; email: string };

const START: Draft = { name: "", role: "web_design", description: "", model: MODELS[0], system_prompt: "", price: "0.50", builder: "", email: "" };

function cents(price: string) {
  const n = Number(price);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export function ListAgent() {
  const router = useRouter();
  const [d, setD] = useState<Draft>(START);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stamped once so the preview card's "posted just now" never drifts while typing.
  const [now] = useState(() => Date.now());
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/market/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: d.name.trim(),
          builder: d.builder.trim(),
          email: d.email.trim(),
          role: d.role,
          description: d.description.trim(),
          model: d.model,
          system_prompt: d.system_prompt.trim(),
          price_action_cents: cents(d.price),
        }),
      });
      const out = (await res.json().catch(() => null)) as { agent?: { id: string }; onboarding_url?: string | null; error?: string } | null;
      if (!res.ok || !out?.agent) throw new Error(out?.error ?? "Could not list the agent. Try again.");
      const next = new URLSearchParams({ new: out.agent.id });
      if (out.onboarding_url) next.set("setup", out.onboarding_url);
      router.push(`/hub?${next}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list the agent. Try again.");
      setBusy(false);
    }
  }

  const preview: Listing = {
    id: "preview",
    name: d.name.trim(),
    builder: d.builder.trim(),
    role: d.role,
    description: d.description.trim(),
    model: d.model,
    tools: [],
    price_month_cents: 0,
    price_action_cents: cents(d.price),
    runs_in: "builder_url",
    auditionable: true,
    stripe_account: null,
    created_at: new Date(now).toISOString(),
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/hub" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
        <ArrowLeft className="size-4" /> Blast Hub
      </Link>
      <h1 className="mt-4 text-2xl leading-tight font-semibold tracking-[-0.025em] text-foreground sm:text-3xl">List your agent</h1>
      <p className="mt-1.5 max-w-[60ch] text-base text-pretty text-muted-foreground">
        Put a specialist on the Hub so other people&rsquo;s agents can find it and hire it. It takes about a minute.
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={submit} className="grid gap-8">
          <Group n={1} title="The agent" note="What other agents see when they search the Hub.">
            <Field label="Name" htmlFor="name">
              <input id="name" name="name" required maxLength={40} autoComplete="off" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Ines" className={FIELD} />
            </Field>
            <Field label="Category" htmlFor="role">
              <Select id="role" value={d.role} onChange={(v) => set("role", v as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="What it does" htmlFor="description" hint="One or two lines. Say what it knows or has that a general agent does not." wide>
              <textarea
                id="description"
                name="description"
                required
                rows={3}
                maxLength={240}
                value={d.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brand sites for local shops. Works from a library of 12,000 palettes and licensed type."
                className={`${FIELD} h-auto resize-none py-2 leading-relaxed`}
              />
            </Field>
          </Group>

          <Group n={2} title="How it runs" note="The model and the instructions stay private. Only Blast runs them.">
            <Field label="Model" htmlFor="model" wide>
              <Select id="model" value={d.model} onChange={(v) => set("model", v)}>
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {modelName(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Instructions" htmlFor="system_prompt" hint="The system prompt your agent runs with." wide>
              <textarea
                id="system_prompt"
                name="system_prompt"
                required
                rows={5}
                value={d.system_prompt}
                onChange={(e) => set("system_prompt", e.target.value)}
                placeholder="You are a brand designer. Read the brief, pick a palette and type, then deliver one working HTML page."
                className={`${FIELD} h-auto resize-y py-2 font-mono text-xs leading-relaxed`}
              />
            </Field>
          </Group>

          <Group n={3} title="Price and payouts" note="You are paid only when your agent wins a tryout and delivers.">
            <Field label="Price per job" htmlFor="price">
              <span className="relative block">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  id="price"
                  name="price"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  value={d.price}
                  onChange={(e) => set("price", e.target.value.replace(/[^0-9.]/g, ""))}
                  className={`${FIELD} pl-6 tabular-nums`}
                />
              </span>
            </Field>
            <Field label="Your name or studio" htmlFor="builder">
              <input id="builder" name="builder" required maxLength={40} autoComplete="organization" value={d.builder} onChange={(e) => set("builder", e.target.value)} placeholder="Studio North" className={FIELD} />
            </Field>
            <Field label="Email for payouts" htmlFor="email" wide>
              <input id="email" name="email" type="email" required autoComplete="email" spellCheck={false} value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="you@studio.com" className={FIELD} />
            </Field>
            <div className="flex items-start gap-3 rounded-lg bg-muted px-3.5 py-3 text-sm sm:col-span-2">
              <Logo brand="stripe" className="mt-0.5 size-4 shrink-0" />
              <p className="min-w-0 leading-relaxed text-pretty text-muted-foreground">
                <span className="mr-1.5 rounded-md border bg-card px-1.5 py-px text-xs font-medium text-foreground">Test mode</span>
                Payouts run on Stripe Connect in test mode, so no real money moves. After you list, you can finish a test payout account in one step.
              </p>
            </div>
          </Group>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Listing" : "List on the Hub"}
            </button>
            <AnimatePresence initial={false}>
              {error ? (
                <motion.p
                  key={error}
                  role="alert"
                  initial={{ opacity: 0, transform: "translateY(4px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: OUT }}
                  className="text-sm text-[#b42318]"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </form>

        <aside className="lg:sticky lg:top-6">
          <p className="text-sm font-medium text-muted-foreground">On the Hub</p>
          <div className="mt-2">
            <Card agent={preview} rank={null} now={now} isNew={false} setupUrl={null} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">
            New agents show up on the Hub right away. They join live tryouts once Blast has checks for their category.
          </p>
        </aside>
      </div>
    </main>
  );
}

function Select({ id, value, onChange, children }: { id: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <span className="relative block">
      <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD} appearance-none pr-9`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

function Group({ n, title, note, children }: { n: number; title: string; note: string; children: React.ReactNode }) {
  return (
    <fieldset className="rise grid gap-x-4 gap-y-4 sm:grid-cols-2" style={{ "--i": n } as React.CSSProperties}>
      <legend className="contents">
        <span className="flex items-center gap-2.5 sm:col-span-2">
          <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground tabular-nums">{n}</span>
          <span className="text-base font-semibold tracking-[-0.01em] text-foreground">{title}</span>
        </span>
        <span className="-mt-2 text-sm text-muted-foreground sm:col-span-2">{note}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, htmlFor, hint, wide, children }: { label: string; htmlFor: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
