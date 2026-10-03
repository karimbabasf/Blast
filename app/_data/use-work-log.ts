"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentCard } from "@/lib/types";
import type { LogTone, RunState } from "./run-state";

export type { LogTone };

export type LogEntry = {
  id: string;
  seconds: number;
  text: string;
  tone: LogTone;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function scoreTone(score: number): LogTone {
  if (score >= 8) return "good";
  if (score >= 5) return "warn";
  return "bad";
}

// Turns table changes into the manager's work log. Every line is keyed by
// the row and event it came from, so a line is written once, when that
// change first shows up, in the order the changes really arrived.
export function useWorkLog(
  { run, jobs, auditions, payments, notes }: RunState,
  cards: AgentCard[],
): LogEntry[] {
  const [log, setLog] = useState<LogEntry[]>([]);
  const seen = useRef(new Set<string>());
  const startedAt = useRef(0);

  useEffect(() => {
    const fresh: Omit<LogEntry, "seconds">[] = [];
    const name = (id: string | null) =>
      cards.find((card) => card.id === id)?.name ?? "An agent";
    const add = (id: string, text: string, tone: LogTone = "info") => {
      if (seen.current.has(id)) return;
      seen.current.add(id);
      fresh.push({ id, text, tone });
    };

    // A new run starts at "splitting" with nothing else yet: start over.
    const restarted =
      run?.status === "splitting" && !notes.length && seen.current.size > 1;
    if (!run || restarted) {
      seen.current.clear();
      startedAt.current = Date.now();
    }
    if (run) {
      for (const note of notes) add(`note-${note.id}`, note.text, note.tone);
      add("goal", "Read the goal");

      if (jobs.length) {
        const skills = jobs.map((job) => job.skill).join(", ");
        add("split", `Split it into ${jobs.length} jobs: ${skills}`);
      }

      for (const job of [...jobs].sort((a, b) => a.order - b.order)) {
        const mine = auditions.filter((a) => a.job_id === job.id);
        if (mine.length) {
          const skipped = mine.filter((a) => a.status === "skipped").length;
          const playing = mine
            .filter((a) => a.status !== "skipped")
            .map((a) => name(a.agent_id));
          add(
            `check-${job.id}`,
            `Checked ${mine.length} agents for ${job.skill}, skipped ${skipped}. Auditioning ${playing.join(", ")}`,
          );
        }
      }

      for (const audition of auditions) {
        const who = name(audition.agent_id);
        if (audition.status === "skipped") continue;
        if (audition.output_text || audition.audio_url) {
          add(`sample-${audition.id}`, `${who} delivered a sample`);
        }
        if (audition.status === "scored" && audition.score !== null) {
          const score = Number(audition.score);
          add(
            `score-${audition.id}`,
            `Judge scored ${who} ${score}: ${audition.reason}`,
            scoreTone(score),
          );
        }
        if (audition.status === "failed") {
          add(`fail-${audition.id}`, `${who} failed: ${audition.reason}`, "bad");
        }
      }

      if (run.status === "waiting") {
        add("waiting", "Auditions are done. Waiting for your approval");
      }

      for (const job of [...jobs].sort((a, b) => a.order - b.order)) {
        if (job.winner_agent_id) {
          add(`hired-${job.id}`, `Hired ${name(job.winner_agent_id)} for ${job.skill}`, "good");
        }
        const payment = payments.find((p) => p.job_id === job.id);
        if (payment) {
          add(
            `paid-${payment.id}`,
            `Paid ${name(payment.agent_id)} ${usd.format(payment.amount_cents / 100)} (${payment.stripe_id ?? payment.status})`,
            "good",
          );
        }
        if (job.status === "done") {
          add(`done-${job.id}`, `${name(job.winner_agent_id)} delivered the ${job.skill}`);
        }
      }

      if (run.status === "done") {
        const spent = payments.reduce((sum, p) => sum + p.amount_cents, 0);
        add(
          "finished",
          `Ad delivered. Margin ${usd.format((run.price_cents - spent) / 100)}`,
          "good",
        );
      }
    }

    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    const lines = fresh.map((entry) => ({ ...entry, seconds }));
    if (!run || restarted) {
      // Keep the same empty list when there is nothing to clear.
      setLog((prev) => (prev.length || lines.length ? lines : prev));
    } else if (lines.length) {
      setLog((prev) => [...prev, ...lines]);
    }
  }, [run, jobs, auditions, payments, notes, cards]);

  return log;
}
