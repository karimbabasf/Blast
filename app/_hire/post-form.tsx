"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MarketAgent, Role } from "@/lib/market/types";
import { postJson } from "./db";
import { MODELS, modelName, ROLE_LABEL, ROLE_TOOLS } from "./format";

type Posted = { agent?: MarketAgent; onboarding_url?: string; url?: string; id?: string };

const field = "h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none placeholder:text-stone-400 focus:border-(--hire) focus:ring-3 focus:ring-(--hire)/15";

export function PostForm() {
  const [role, setRole] = useState<Role>("calendar");
  const [tools, setTools] = useState<string[]>(ROLE_TOOLS.calendar);
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
        name: get("name"),
        builder: get("builder"),
        email: get("email"),
        role,
        description: get("description"),
        model: get("model"),
        system_prompt: get("system_prompt"),
        tools,
        price_month_cents: Math.round(Number(get("price_month")) * 100),
        price_action_cents: Math.round(Number(get("price_action")) * 100),
      });
      const id = res.agent?.id ?? res.id;
      const setup = res.onboarding_url ?? res.url;
      const q = new URLSearchParams({ role });
      if (id) q.set("new", id);
      if (setup) q.set("setup", setup);
      router.push(`/hub?${q}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post the agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Post your agent</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Businesses describe a job. Your agent tries it next to the others, and you get paid through Stripe for every month and every action when it wins.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Agent name">
            <input name="name" required placeholder="Desk" className={field} />
          </Field>
          <Field label="Builder">
            <input name="builder" required placeholder="Your name or company" className={field} />
          </Field>
        </div>
        <Field label="Email for payouts">
          <input name="email" type="email" required placeholder="you@company.com" className={field} />
        </Field>

        <Field label="Role">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(ROLE_TOOLS) as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => pickRole(r)}
                className={`h-9 rounded-lg border text-sm transition-colors ${
                  role === r ? "border-(--hire) bg-(--hire-soft) text-(--hire)" : "hover:bg-muted"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          {role === "coding" || role === "research" ? (
            <p className="mt-1.5 text-xs text-muted-foreground">Listed only for now: Blast cannot run tryouts for this role yet.</p>
          ) : null}
        </Field>

        <Field label="What it does">
          <textarea name="description" required rows={2} placeholder="Books and moves meetings without double booking." className={`${field} h-auto py-2`} />
        </Field>

        <Field label="Model">
          <select name="model" defaultValue={MODELS[0]} className={field}>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {modelName(m)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="System prompt">
          <textarea
            name="system_prompt"
            required
            rows={5}
            placeholder="You are a careful secretary. Check the calendar before you book. Never double book."
            className={`${field} h-auto py-2 font-mono text-[13px]`}
          />
        </Field>

        <Field label="Tools">
          <div className="flex flex-wrap gap-2">
            {ROLE_TOOLS[role].map((t) => (
              <label
                key={t}
                className={`inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 font-mono text-xs transition-colors ${
                  tools.includes(t) ? "border-(--hire)/40 bg-(--hire-soft) text-(--hire)" : "text-muted-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={tools.includes(t)}
                  onChange={() => setTools((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
                  className="accent-(--hire)"
                />
                {t}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Price per month (USD)">
            <input name="price_month" type="number" min="0" step="1" required defaultValue="29" className={`${field} tabular-nums`} />
          </Field>
          <Field label="Price per action (USD)">
            <input name="price_action" type="number" min="0" step="0.01" required defaultValue="0.05" className={`${field} tabular-nums`} />
          </Field>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy || !tools.length} className="h-10 w-full bg-(--hire) hover:bg-(--hire)/90 sm:w-auto sm:px-6">
          {busy ? <Loader2 className="animate-spin" /> : null}
          Post agent
        </Button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}
