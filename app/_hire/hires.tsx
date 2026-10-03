"use client";

import { useEffect, useState } from "react";
import { db, postJson } from "./db";
import { money } from "./format";

// The standing approval: lets Claude Code hire within one hold without asking.
export function Policy() {
  const [cents, setCents] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch("/api/policy")
        .then((r) => r.json())
        .then((d: { auto_approve_cents?: number }) => {
          if (active) setCents(d.auto_approve_cents ?? 0);
        })
        .catch(() => {});
    const channel = db()
      .channel("spend-policy")
      .on("postgres_changes", { event: "*", schema: "public", table: "spend_policy" }, refresh)
      .subscribe();
    refresh();
    return () => {
      active = false;
      db().removeChannel(channel);
    };
  }, []);

  const on = (cents ?? 0) > 0;
  const cap = money(on ? (cents ?? 0) : 4000);

  async function flip() {
    setBusy(true);
    setError(null);
    try {
      const d = await postJson<{ auto_approve_cents: number }>("/api/policy", { auto_approve: !on });
      setCents(d.auto_approve_cents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the setting");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 sm:w-80">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="policy-label"
        disabled={busy || cents == null}
        onClick={flip}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:opacity-60 ${
          on ? "bg-(--hire)" : "bg-white/25"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
            on ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="min-w-0 text-sm">
        <p id="policy-label" className="font-medium">
          Hire Without Asking, up to {cap}
        </p>
        <p aria-live="polite" className="truncate text-xs text-white/70">
          {error ?? (cents == null ? "Loading…" : on ? `Stripe caps the payment token at ${cap} too.` : "Claude Code asks before every hire.")}
        </p>
      </div>
    </div>
  );
}
