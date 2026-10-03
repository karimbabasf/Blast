"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RUN_BUDGET_CENTS,
  RUN_PRICE_CENTS,
  type Audition,
  type Job,
  type Payment,
  type Run,
  type RunMode,
  type Skill,
} from "@/lib/types";
import { CARDS, FAKE_BRIEFS, FAKE_SAMPLES } from "./fake";

export type RunState = {
  run: Run | null;
  jobs: Job[];
  auditions: Audition[];
  payments: Payment[];
};

const EMPTY: RunState = { run: null, jobs: [], auditions: [], payments: [] };
const SKILLS: Skill[] = ["script", "voice"];

function candidates(skill: Skill) {
  return CARDS.filter((card) => card.real && card.skills.includes(skill));
}

function winner(skill: Skill) {
  return candidates(skill).reduce((best, card) =>
    FAKE_SAMPLES[card.id].score > FAKE_SAMPLES[best.id].score ? card : best,
  );
}

// Chunk 1: plays the run from fake data on timers. The table shapes match
// SPEC.md, so this swaps for Supabase Realtime and the API routes later.
export function useRun() {
  const [state, setState] = useState<RunState>(EMPTY);
  const timers = useRef<number[]>([]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const setRunStatus = useCallback(
    (status: Run["status"]) =>
      setState((s) => (s.run ? { ...s, run: { ...s.run, status } } : s)),
    [],
  );

  const patchJob = useCallback(
    (id: string, patch: Partial<Job>) =>
      setState((s) => ({
        ...s,
        jobs: s.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      })),
    [],
  );

  const hire = useCallback(() => {
    setRunStatus("hiring");
    const script = winner("script");
    const voice = winner("voice");
    const scriptText = FAKE_SAMPLES[script.id].text;

    const pay = (skill: Skill, agentId: string, amount: number) =>
      setState((s) => ({
        ...s,
        jobs: s.jobs.map((job) =>
          job.skill === skill
            ? { ...job, status: "hired", winner_agent_id: agentId }
            : job,
        ),
        payments: [
          ...s.payments,
          {
            id: `pay-${skill}`,
            run_id: s.run?.id ?? "",
            job_id: `job-${skill}`,
            agent_id: agentId,
            amount_cents: amount,
            stripe_id: `pi_fake_${skill}`,
            status: "paid",
          },
        ],
      }));

    later(700, () => pay("script", script.id, script.price_cents));
    later(1500, () =>
      patchJob("job-script", { status: "done", output_text: scriptText }),
    );
    later(2200, () => pay("voice", voice.id, voice.price_cents));
    later(3200, () => {
      patchJob("job-voice", { status: "done", output_text: scriptText });
      setRunStatus("done");
    });
  }, [later, patchJob, setRunStatus]);

  const start = useCallback(
    (goal: string, mode: RunMode) => {
      clearTimers();
      setState({
        ...EMPTY,
        run: {
          id: crypto.randomUUID(),
          goal,
          mode,
          budget_cents: RUN_BUDGET_CENTS,
          price_cents: RUN_PRICE_CENTS,
          status: "splitting",
          created_at: new Date().toISOString(),
        },
      });

      const splitMs = 900;
      later(splitMs, () =>
        setState((s) => ({
          ...s,
          run: s.run && { ...s.run, status: "auditioning" },
          jobs: SKILLS.map((skill, index) => ({
            id: `job-${skill}`,
            run_id: s.run?.id ?? "",
            skill,
            brief: FAKE_BRIEFS[skill],
            order: index + 1,
            status: "auditioning",
            winner_agent_id: null,
            output_text: null,
            audio_url: null,
          })),
          auditions: SKILLS.flatMap((skill) =>
            CARDS.map((card) => {
              const plays = card.real && card.skills.includes(skill);
              return {
                id: `aud-${skill}-${card.id}`,
                job_id: `job-${skill}`,
                agent_id: card.id,
                status: plays ? "running" : "skipped",
                skip_reason: plays
                  ? null
                  : card.skills.includes(skill)
                    ? "Not available"
                    : "Wrong skill",
                output_text: null,
                audio_url: null,
                score: null,
                reason: null,
              } satisfies Audition;
            }),
          ),
        })),
      );

      let lastScore = 0;
      SKILLS.forEach((skill, index) => {
        candidates(skill).forEach((card) => {
          const sample = FAKE_SAMPLES[card.id];
          const at = splitMs + sample.delay + index * 500;
          lastScore = Math.max(lastScore, at);
          later(at, () =>
            setState((s) => ({
              ...s,
              auditions: s.auditions.map((audition) =>
                audition.id === `aud-${skill}-${card.id}`
                  ? {
                      ...audition,
                      status: "scored",
                      output_text: sample.text,
                      score: sample.score,
                      reason: sample.reason,
                    }
                  : audition,
              ),
            })),
          );
        });
      });

      later(lastScore + 600, () => {
        setState((s) => ({
          ...s,
          run: s.run && { ...s.run, status: "waiting" },
          jobs: s.jobs.map((job) => ({ ...job, status: "waiting" })),
        }));
        const total = SKILLS.reduce((sum, s) => sum + winner(s).price_cents, 0);
        if (mode === "auto" && total <= RUN_BUDGET_CENTS) later(700, hire);
      });
    },
    [clearTimers, hire, later],
  );

  return { ...state, cards: CARDS, start, approve: hire };
}
