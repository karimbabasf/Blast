"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MarketAgent, Role } from "@/lib/market/types";
import { AgentAvatar } from "../_components/agent-avatar";
import { LogoFactory } from "../_components/agent-logo";
import { postJson } from "./db";
import { MODELS, modelName, money, ROLE_LABEL, ROLE_TOOLS, toolLabel } from "./format";
import { handle } from "./hub";

type Posted = { agent?: MarketAgent; onboarding_url?: string; url?: string; id?: string };

const field =
  "h-10 w-full rounded-xl border bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus-visible:border-(--hire) focus-visible:ring-3 focus-visible:ring-(--hire)/15";
const pill =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97]";
const on = "border-foreground bg-foreground text-background";
const off = "text-muted-foreground hover:bg-muted";

const PREVIEW = { id: "preview" };
const NEXT = ["Listed on the Hub", "Tries out on every matching job", "Paid through Stripe when its work proves out"];

export function PostForm() {
  const [name, setName] = useState("");
  const [builder, setBuilder] = useState("");
  const [role, setRole] = useState<Role>("auto_repair");
  const [tools, setTools] = useState<string[]>(ROLE_TOOLS.auto_repair);
  const [model, setModel] = useState(MODELS[0]);
  const [month, setMonth] = useState("29");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function pickRole(r: Role) {
    setRole(r);
    setTools(ROLE_TOOLS[r]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<Posted>("/api/market/agents", {
        name: name.trim(),
        builder: builder.trim(),
        email: get("email"),
        role,
        description: get("description"),
        model,
        system_prompt: get("system_prompt"),
        tools,
        price_month_cents: Math.round(Number(month) * 100),
        price_action_cents: Math.round(Number(get("price_action")) * 100),
      });
      const id = res.agent?.id ?? res.id;
      const setup = res.onboarding_url ?? res.url;
      const q = new URLSearchParams({ role });
      if (id) q.set("new", id);
      if (setup) q.set("setup", setup);
      router.push(`/hub?${q}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the specialist");
    } finally {
      setBusy(false);
    }
  }

  const listedOnly = role === "coding" || role === "research";

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight sm:text-4xl">Post Your Specialist</h1>
          <p className="mt-1 text-sm text-muted-foreground">It tries out next to the others on real jobs. You get paid when it wins.</p>
        </div>

        <Step n={1} title="Who It Is">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name">
              <input name="name" required autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="Torque…" className={field} />
            </Field>
            <Field label="Builder">
              <input name="builder" required autoComplete="organization" value={builder} onChange={(e) => setBuilder(e.target.value)} placeholder="GarageWorks…" className={field} />
            </Field>
            <Field label="Email for Payouts">
              <input name="email" type="email" required autoComplete="email" spellCheck={false} placeholder="you@company.com…" className={field} />
            </Field>
          </div>
        </Step>

        <Step n={2} title="What It Can Do">
          <Group label="Role">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => pickRole(r)} className={`${pill} ${role === r ? on : off}`}>
                {ROLE_LABEL[r]}
              </button>
            ))}
          </Group>
          <Group label="Tools">
            {ROLE_TOOLS[role].map((t) => {
              const has = tools.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={has}
                  title={t}
                  onClick={() => setTools((cur) => (has ? cur.filter((x) => x !== t) : [...cur, t]))}
                  className={`${pill} ${has ? on : `${off} line-through`}`}
                >
                  <Check aria-hidden="true" className={`size-3.5 transition-opacity duration-150 ease-out ${has ? "" : "opacity-0"}`} strokeWidth={3} />
                  {toolLabel(t)}
                </button>
              );
            })}
          </Group>
          <p className="h-4 text-xs text-muted-foreground">{listedOnly ? "Listed only for now: Blast cannot run tryouts for this role yet." : ""}</p>
        </Step>

        <Step n={3} title="How It Thinks">
          <Group label="Model">
            {MODELS.map((m) => (
              <button key={m} type="button" aria-pressed={model === m} onClick={() => setModel(m)} className={`${pill} ${model === m ? on : off}`}>
                {modelName(m)}
              </button>
            ))}
          </Group>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="What It Does">
              <textarea name="description" required rows={4} placeholder="Diagnoses engine codes and writes the repair estimate…" className={`${field} h-auto resize-none py-2`} />
            </Field>
            <Field label="Instructions">
              <textarea
                name="system_prompt"
                required
                rows={4}
                placeholder="You are a careful mechanic. Check the service bulletins before you quote…"
                className={`${field} h-auto resize-none py-2`}
              />
            </Field>
          </div>
        </Step>

        <Step n={4} title="What It Costs">
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <Field label="Per Month (USD)">
              <input name="price_month" type="number" inputMode="decimal" min="0" step="1" required value={month} onChange={(e) => setMonth(e.target.value)} className={`${field} tabular-nums`} />
            </Field>
            <Field label="Per Action (USD)">
              <input name="price_action" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue="0.05" className={`${field} tabular-nums`} />
            </Field>
          </div>
        </Step>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={busy || !tools.length} className="h-10 w-40 rounded-full bg-(--hire) hover:bg-(--hire)/90">
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Posting…
              </>
            ) : (
              "Post Specialist"
            )}
          </Button>
          <p aria-live="polite" className="min-w-0 truncate text-sm text-destructive">
            {error}
          </p>
        </div>
      </form>

      <aside className="rounded-3xl bg-block-blue p-5 text-white lg:sticky lg:top-6">
        <h2 className="text-sm font-medium">How Businesses See It</h2>
        <article className="mt-3 flex flex-col gap-3 rounded-2xl bg-card p-4 text-card-foreground">
          <div className="flex items-center gap-3">
            <AgentAvatar card={{ ...PREVIEW, name: name || "Your specialist" }} size="lg" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base leading-5 font-semibold" translate="no">
                {name || "Your specialist"}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {handle(builder || "you")} · {modelName(model)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{ROLE_LABEL[role]}</span>
          </div>
          <dl className="grid grid-cols-4 gap-1.5 tabular-nums">
            {[
              ["New", "Score"],
              ["0", "Tryouts"],
              ["0", "Hires"],
              [money(Math.round(Number(month) * 100) || 0), "Per mo"],
            ].map(([value, label]) => (
              <div key={label} className="flex h-13 flex-col justify-center rounded-lg bg-muted/60 px-2">
                <dd className="truncate text-lg leading-6 font-semibold">{value}</dd>
                <dt className="truncate text-[11px] leading-4 opacity-70">{label}</dt>
              </div>
            ))}
          </dl>
          <ul aria-label="Tools" className="flex h-12 flex-wrap content-start gap-1 overflow-hidden">
            {ROLE_TOOLS[role].map((t) => (
              <li
                key={t}
                className={`h-5 rounded-full px-2 text-xs leading-5 transition-colors duration-150 ease-out ${
                  tools.includes(t) ? "bg-muted" : "text-muted-foreground/60 line-through"
                }`}
              >
                {toolLabel(t)}
              </li>
            ))}
          </ul>
        </article>

        <h2 className="mt-5 text-sm font-medium">What Happens Next</h2>
        <ol className="mt-2 flex flex-col gap-2 text-sm">
          {NEXT.map((line, index) => (
            <li key={line} className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary tabular-nums">
                {index + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </aside>
      <LogoFactory ids={[PREVIEW.id]} />
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-foreground/10">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs tabular-nums">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
