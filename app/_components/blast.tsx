"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import type { RunMode } from "@/lib/types";
import { DEFAULT_GOAL } from "../_data/fake";
import { useRun } from "../_data/use-run";
import { ApproveBar } from "./approve-bar";
import { Board } from "./board";
import { GoalForm } from "./goal-form";
import { ModeDial } from "./mode-dial";
import { Receipt } from "./receipt";
import { StatusLine } from "./status-line";

export function Blast() {
  const { run, jobs, auditions, payments, cards, start, approve } = useRun();
  const [mode, setMode] = useState<RunMode>("approve");
  const busy = run !== null && run.status !== "done";

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight" translate="no">
              Blast
            </h1>
            <p className="text-sm text-muted-foreground">
              A manager agent that auditions and hires other agents for you.
            </p>
          </div>
          <ModeDial mode={mode} onChange={setMode} disabled={busy} />
        </header>

        <GoalForm
          defaultGoal={DEFAULT_GOAL}
          busy={busy}
          done={run?.status === "done"}
          onStart={(goal) => start(goal, mode)}
        />

        {run && <StatusLine status={run.status} />}

        {jobs.length > 0 && (
          <Board jobs={jobs} auditions={auditions} cards={cards} />
        )}

        <AnimatePresence>
          {run?.status === "waiting" && run.mode === "approve" && (
            <ApproveBar
              jobs={jobs}
              auditions={auditions}
              cards={cards}
              budgetCents={run.budget_cents}
              onApprove={approve}
            />
          )}
        </AnimatePresence>

        {run?.status === "done" && (
          <Receipt run={run} jobs={jobs} payments={payments} cards={cards} auditions={auditions} />
        )}
      </main>
    </MotionConfig>
  );
}
